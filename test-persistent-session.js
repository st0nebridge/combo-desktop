/**
 * Test script to verify persistent partitions
 */

const { spawn } = require('child_process');

console.log('🧪 Testing persistent partition creation...\n');

const child = spawn('node', ['src/main.js', '--whatsapp', '--profile', 'testpersist'], {
    stdio: 'pipe'
});

let output = '';

child.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    process.stdout.write(text);
});

child.stderr.on('data', (data) => {
    const text = data.toString();
    output += text;
    process.stderr.write(text);
});

// Stop after 5 seconds
setTimeout(() => {
    console.log('\n⏰ Stopping test after 5 seconds...');
    child.kill();
    
    // Analyze output
    console.log('\n📊 Analysis:');
    if (output.includes('persist:desk-tray:WhatsApp:testpersist')) {
        console.log('✅ Persistent partition name detected');
    } else {
        console.log('❌ Persistent partition name NOT detected');
    }
    
    if (output.includes('Session storage path:')) {
        console.log('✅ Session storage path logged');
    } else {
        console.log('❌ Session storage path NOT logged');
    }
    
    if (output.includes('No storage path for partition')) {
        console.log('⚠️  Warning: No storage path detected');
    } else {
        console.log('✅ No storage path warnings');
    }
    
    process.exit(0);
}, 5000);

child.on('exit', () => {
    console.log('\n🏁 App exited');
});
