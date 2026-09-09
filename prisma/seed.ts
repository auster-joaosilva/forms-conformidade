import { bootstrap } from '../src/lib/bootstrap.js'
import { prisma } from '../src/lib/prisma.js'

async function main() {
  const result = await bootstrap()

  if (result.master) {
    console.log(`Master user ready: ${result.master}`)
  } else {
    console.log('MASTER_USER_EMAIL/MASTER_USER_PASSWORD not set, skipped')
  }

  if (result.directory) {
    console.log(
      `Authentik sync: ${result.directory.users} users, ${result.directory.departments} departments`,
    )
  } else {
    console.log('Authentik sync disabled')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
