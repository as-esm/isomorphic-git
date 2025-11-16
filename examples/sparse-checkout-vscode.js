#!/usr/bin/env node
/**
 * Sparse Checkout Example: Visual Studio Code
 * 
 * This script clones only the src/ folder from VS Code repository
 * into a .dump directory and adds .dump to .gitignore
 */

import path from 'path'
import fs from 'fs'
import * as git from '../index.js'
import { sparseCheckout } from '../src/commands/sparseCheckout.ts'
import http from '../http/node/index.js'

// Configuration
const VSCODE_REPO_URL = 'https://github.com/microsoft/vscode.git'
const DUMP_DIR = path.join(process.cwd(), '.dump')

// Helper to format time
function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// Progress tracking
let lastProgressUpdate = Date.now()
const PROGRESS_UPDATE_INTERVAL = 2000 // Update every 2 seconds

function logProgress(event) {
  const now = Date.now()
  if (now - lastProgressUpdate < PROGRESS_UPDATE_INTERVAL && event.total) {
    return // Throttle updates
  }
  lastProgressUpdate = now
  
  if (event.total) {
    const percent = ((event.loaded / event.total) * 100).toFixed(1)
    process.stdout.write(`\r  ${event.phase}: ${percent}% (${event.loaded}/${event.total})`)
  } else {
    process.stdout.write(`\r  ${event.phase}: ${event.loaded} items`)
  }
}

async function main() {
  const startTime = Date.now()
  console.log('🚀 Starting sparse checkout of VS Code src/ folder...\n')
  
  // Step 1: Create .dump directory
  const step1Start = Date.now()
  if (!fs.existsSync(DUMP_DIR)) {
    fs.mkdirSync(DUMP_DIR, { recursive: true })
    console.log('✓ Created .dump directory')
  } else {
    console.log('✓ .dump directory already exists')
  }
  console.log(`  Time: ${formatTime(Date.now() - step1Start)}\n`)
  
  // Step 2: Add .dump to .gitignore
  const step2Start = Date.now()
  const gitignorePath = path.join(process.cwd(), '.gitignore')
  let gitignore = fs.existsSync(gitignorePath) 
    ? fs.readFileSync(gitignorePath, 'utf8') 
    : ''
  
  if (!gitignore.includes('.dump')) {
    gitignore += (gitignore ? '\n' : '') + '.dump\n'
    fs.writeFileSync(gitignorePath, gitignore)
    console.log('✓ Added .dump to .gitignore')
  } else {
    console.log('✓ .dump already in .gitignore')
  }
  console.log(`  Time: ${formatTime(Date.now() - step2Start)}\n`)
  
  // Step 3: Clone repository (no checkout)
  // Use shallow clone with single branch for faster cloning
  const step3Start = Date.now()
  console.log('📥 Cloning VS Code repository (shallow clone, single branch)...')
  console.log('   Using depth=1 and singleBranch=true for faster cloning')
  console.log('   This downloads only the latest commit, not the full history.')
  
  let clonePhase = 'Starting...'
  let cloneProgress = { loaded: 0, total: 0 }
  
  await git.clone({
    fs,
    http,
    dir: DUMP_DIR,
    url: VSCODE_REPO_URL,
    noCheckout: true,
    depth: 1, // Shallow clone: only get the latest commit
    singleBranch: true, // Only fetch the default branch
    onProgress: (event) => {
      clonePhase = event.phase
      cloneProgress = { loaded: event.loaded, total: event.total }
      logProgress(event)
    },
    onMessage: (message) => {
      if (message.trim()) {
        console.log(`\n  [Git] ${message.trim()}`)
      }
    }
  })
  
  // Clear progress line and show final status
  process.stdout.write('\r' + ' '.repeat(80) + '\r')
  console.log(`✓ Repository cloned`)
  if (cloneProgress.total) {
    console.log(`  Final: ${clonePhase} - ${cloneProgress.loaded}/${cloneProgress.total}`)
  }
  console.log(`  Time: ${formatTime(Date.now() - step3Start)}\n`)
  
  // Step 4: Initialize sparse checkout
  const step4Start = Date.now()
  console.log('⚙️  Initializing sparse checkout...')
  console.log('   Creating sparse-checkout configuration files...')
  console.log('   Using cone mode for better performance with directory-based patterns')
  await sparseCheckout({
    fs,
    dir: DUMP_DIR,
    init: true,
    cone: true // Cone mode is faster and recommended for directory patterns like src/
  })
  console.log('✓ Sparse checkout initialized (cone mode enabled)')
  console.log(`  Time: ${formatTime(Date.now() - step4Start)}\n`)
  
  // Step 5: Set pattern to src/ and checkout
  // Note: sparseCheckout({ set: ... }) automatically performs the checkout
  const step5Start = Date.now()
  console.log('📝 Setting sparse checkout pattern to src/...')
  console.log('   This configures which files will be checked out and applies the checkout...')
  console.log('   (This may take a while for large repositories like VS Code)')
  
  let checkoutPhase = 'Starting...'
  let checkoutProgress = { loaded: 0, total: 0 }
  let lastCheckoutUpdate = Date.now()
  
  // We need to add progress tracking to sparseCheckout
  // For now, we'll just call it and then verify
  await sparseCheckout({
    fs,
    dir: DUMP_DIR,
    set: ['src/'],
    cone: true
  })
  
  console.log('✓ Sparse checkout pattern set to src/ and checkout applied')
  console.log(`  Time: ${formatTime(Date.now() - step5Start)}\n`)
  
  // Step 6: Verify sparse checkout configuration
  const step6Start = Date.now()
  console.log('🔍 Verifying sparse checkout configuration...')
  
  // Check sparse-checkout file
  const sparseCheckoutFile = path.join(DUMP_DIR, '.git', 'info', 'sparse-checkout')
  try {
    const sparseContent = fs.readFileSync(sparseCheckoutFile, 'utf8')
    console.log('   Sparse-checkout patterns:')
    sparseContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        console.log(`     - ${trimmed}`)
      }
    })
  } catch (err) {
    console.log('   ⚠️  Sparse-checkout file not found!')
  }
  
  // Check config
  const configFile = path.join(DUMP_DIR, '.git', 'config')
  try {
    const configContent = fs.readFileSync(configFile, 'utf8')
    if (configContent.includes('sparseCheckout')) {
      console.log('   Sparse checkout enabled in config')
    }
  } catch (err) {
    console.log('   ⚠️  Config file not found!')
  }
  console.log(`  Time: ${formatTime(Date.now() - step6Start)}\n`)
  
  // Step 7: Verify files
  const step7Start = Date.now()
  console.log('🔍 Verifying checked out files...')
  const files = await git.listFiles({ fs, dir: DUMP_DIR })
  const srcFiles = files.filter(f => f.startsWith('src/'))
  const nonSrcFiles = files.filter(f => !f.startsWith('src/') && !f.startsWith('.git/'))
  
  console.log(`  Time: ${formatTime(Date.now() - step7Start)}\n`)
  
  // Summary
  const totalTime = Date.now() - startTime
  console.log(`✅ Complete!`)
  console.log(`   Location: ${DUMP_DIR}`)
  console.log(`   Total files in index: ${files.length}`)
  console.log(`   Files in src/: ${srcFiles.length}`)
  console.log(`   Files NOT in src/: ${nonSrcFiles.length}`)
  
  if (nonSrcFiles.length > 0) {
    console.log(`\n   ⚠️  WARNING: Found ${nonSrcFiles.length} files outside of src/!`)
    console.log(`   This suggests sparse checkout may not be working correctly.`)
    console.log(`   Example non-src files:`)
    nonSrcFiles.slice(0, 10).forEach(file => {
      console.log(`     - ${file}`)
    })
    if (nonSrcFiles.length > 10) {
      console.log(`     ... and ${nonSrcFiles.length - 10} more`)
    }
  }
  
  if (srcFiles.length > 0) {
    console.log(`\n   Example src/ files:`)
    srcFiles.slice(0, 5).forEach(file => {
      console.log(`     - ${file}`)
    })
    if (srcFiles.length > 5) {
      console.log(`     ... and ${srcFiles.length - 5} more`)
    }
  }
  console.log(`\n   Total time: ${formatTime(totalTime)}`)
}

main().catch(err => {
  console.error('\n❌ Error:', err.message)
  if (err.stack) {
    console.error('\nStack trace:')
    console.error(err.stack)
  }
  process.exit(1)
})

