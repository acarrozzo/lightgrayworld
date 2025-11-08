# Local Development Setup - Complete Workflow

This guide provides a step-by-step terminal workflow to get your local development environment working.

## Prerequisites

- Node.js 18+ installed
- Docker Desktop (or Docker Engine with Compose plugin) installed and running
- npm or yarn package manager

## Complete Setup Workflow

### Step 1: Install Dependencies

```bash
npm install
```

This will:
- Install all npm packages
- Run `prisma generate` automatically (via postinstall script)
- Install `tsx` for running TypeScript seed files

### Step 2: Set Up Environment Variables

```bash
# Copy the environment template
cp env.local.template .env.local
```

Verify `.env.local` contains:
```
DATABASE_URL=postgresql://lgai:lgai_dev_password@localhost:5432/lgai_dev
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_PATH=/socket.io
```

### Step 3: Start PostgreSQL Database

```bash
# Start the database container
docker compose up -d

# Verify it's running
docker ps | grep lgai-postgres
```

Expected output: Container should be running and healthy.

### Step 4: Run Database Migrations

```bash
# Create database tables from Prisma schema
npx prisma migrate dev

# Or if you prefer to push schema without creating migration files:
# npx prisma db push
```

This will:
- Create all database tables
- Generate Prisma client
- Create a migration file

**Expected output:**
```
✔ Generated Prisma Client
✔ Applied migration
```

### Step 5: Seed the Database

```bash
# Run the seed script to populate rooms, NPCs, and test user
npx prisma db seed
```

**Expected output:**
```
🌱 Seeding database...
✅ Database seeded successfully!
👤 Test user created: testuser (password: password123)
🏠 Created 22 rooms
🧍 Seeded 4 NPCs
```

### Step 6: Verify Database Seeding

```bash
# Option 1: Check via Prisma Studio (visual database browser)
npx prisma studio

# Option 2: Query directly via psql
docker exec -it lgai-postgres psql -U lgai -d lgai_dev -c "SELECT COUNT(*) FROM \"Room\";"
```

Expected: Should show 22 rooms (or the number defined in seed.ts).

### Step 7: Start Development Server

```bash
# Start the Next.js development server
npm run dev
```

**Expected output:**
```
✓ Compiled successfully
✓ Ready on http://localhost:3000
```

### Step 8: Verify Application Works

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Login with test credentials:
   - Username: `testuser`
   - Password: `password123`
3. You should see room "001" (Grassy Field Crossroads) loaded

## Troubleshooting

### Database Connection Issues

If you get connection errors:

```bash
# Check if database container is running
docker ps | grep postgres

# Check database logs
docker logs lgai-postgres

# Restart database
docker compose restart postgres

# Verify DATABASE_URL in .env.local matches docker-compose.yml
cat .env.local | grep DATABASE_URL
```

### Seed Script Fails

If `npx prisma db seed` fails:

```bash
# Check if tsx is installed
npm list tsx

# Install tsx if missing
npm install --save-dev tsx

# Try running seed directly
npx tsx prisma/seed.ts

# Check for TypeScript errors
npx tsc --noEmit prisma/seed.ts
```

### Database Still Empty After Seeding

If rooms still don't exist after seeding:

```bash
# 1. Verify migrations ran successfully
npx prisma migrate status

# 2. Check if seed script ran without errors
npx prisma db seed

# 3. Verify database connection
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Room\";"

# 4. Check server logs for diagnostic information
# The room API now includes diagnostic logging that shows:
# - Total rooms in database
# - Sample room IDs
# - Suggestions if database is empty
```

### Reset Database (Fresh Start)

If you need to start completely fresh:

```bash
# Stop and remove database container and volumes
docker compose down -v

# Start fresh database
docker compose up -d

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed
```

## Quick Reference Commands

```bash
# Start database
docker compose up -d

# Stop database (keeps data)
docker compose down

# Stop database and delete all data
docker compose down -v

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# View database
npx prisma studio

# Generate Prisma client
npx prisma generate

# Start dev server
npm run dev
```

## Verification Checklist

After completing the setup, verify:

- [ ] Docker container is running: `docker ps | grep postgres`
- [ ] Database connection works: `npx prisma db execute --stdin <<< "SELECT 1;"`
- [ ] Rooms exist: Check via Prisma Studio or API logs
- [ ] Seed script runs without errors: `npx prisma db seed`
- [ ] Development server starts: `npm run dev`
- [ ] Application loads room data: Check browser console for room API calls

## Common Issues and Solutions

### Issue: "Database appears to be empty"

**Solution:**
1. Verify migrations ran: `npx prisma migrate status`
2. Run seed script: `npx prisma db seed`
3. Check seed output for errors
4. Verify DATABASE_URL is correct

### Issue: "Cannot connect to database"

**Solution:**
1. Check Docker is running: `docker ps`
2. Start database: `docker compose up -d`
3. Verify DATABASE_URL in `.env.local`
4. Check database logs: `docker logs lgai-postgres`

### Issue: "tsx command not found"

**Solution:**
1. Install tsx: `npm install --save-dev tsx`
2. Verify package.json has `prisma.seed` configuration
3. Try running seed directly: `npx tsx prisma/seed.ts`

## Next Steps

Once your local environment is working:

1. **Test the application**: Login and navigate between rooms
2. **Check API logs**: The room API now includes diagnostic logging
3. **Explore Prisma Studio**: `npx prisma studio` to view database
4. **Start developing**: Make changes and see them hot-reload

## Support

If you continue to have issues:

1. Check the diagnostic logs in the browser console
2. Check server logs for detailed error messages
3. Verify all steps in this guide were completed
4. Check that DATABASE_URL matches your docker-compose.yml configuration

