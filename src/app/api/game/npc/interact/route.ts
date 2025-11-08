export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { NPCDialogueEngine } from '@/lib/game-engine/npc-dialogue'

interface DialogueRequestBody {
  npcId: string
  step: 'open' | 'respond'
  nodeId?: string
  responseIndex?: number
}

const dialogueEngine = new NPCDialogueEngine(prisma)

async function handlePost(request: AuthenticatedRequest) {
  try {
    const body = (await request.json()) as DialogueRequestBody
    if (!body?.npcId || !body.step) {
      return NextResponse.json({ message: 'npcId and step are required' }, { status: 400 })
    }

    const npc = await prisma.nPC.findUnique({
      where: { id: body.npcId },
      include: { definition: true },
    })

    if (!npc) {
      return NextResponse.json({ message: 'NPC not found' }, { status: 404 })
    }

    const dialogueTree =
      (npc.dialogueTree as any) || (npc.definition?.dialogueTree as any) || null
    if (!dialogueTree) {
      return NextResponse.json({ message: 'NPC has no dialogue configured' }, { status: 404 })
    }

    const playerState = await dialogueEngine.loadPlayerState(request.user.id)

    if (body.step === 'open') {
      const evaluation = dialogueEngine.evaluate(dialogueTree, dialogueTree.root, playerState)
      return NextResponse.json({
        node: evaluation.node,
        responses: evaluation.responses.map((response, index) => ({
          index,
          ...response,
        })),
      })
    }

    if (!body.nodeId || body.responseIndex === undefined) {
      return NextResponse.json(
        { message: 'nodeId and responseIndex are required' },
        { status: 400 }
      )
    }

    const evaluation = dialogueEngine.evaluate(dialogueTree, body.nodeId, playerState)
    const response = evaluation.responses[body.responseIndex]
    if (!response) {
      return NextResponse.json({ message: 'Invalid response selection' }, { status: 400 })
    }

    const actionResult = await dialogueEngine.applyAction(response.action, npc.id, request.user.id)

    const nextNodeId = response.next || evaluation.node.id
    const updatedPlayerState = await dialogueEngine.loadPlayerState(request.user.id)
    const nextEvaluation = dialogueEngine.evaluate(dialogueTree, nextNodeId, updatedPlayerState)

    return NextResponse.json({
      node: nextEvaluation.node,
      responses: nextEvaluation.responses.map((response, index) => ({
        index,
        ...response,
      })),
      actionResult,
    })
  } catch (error) {
    console.error('[NPC Dialogue] Failed to process interaction', error)
    return NextResponse.json({ message: 'Failed to process dialogue' }, { status: 500 })
  }
}

export const POST = withAuth(handlePost)

