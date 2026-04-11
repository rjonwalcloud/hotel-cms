const bcrypt = require('bcrypt');

async function generateAndVerifyHash() {
    const password = 'Admin@123';

    console.log('Generating hash for password:', password);
    const hash = await bcrypt.hash(password, 10);
    console.log('Generated hash:', hash);

    // Verify it immediately
    const isValid = await bcrypt.compare(password, hash);
    console.log('Verification result:', isValid);

    if (isValid) {
        console.log('\n✅ SUCCESS! This hash is VALID for Admin@123');
        console.log('Use this hash in schema.sql:\n');
        console.log(hash);
    } else {
        console.log('\n❌ ERROR! Hash verification failed!');
    }
}

generateAndVerifyHash();
