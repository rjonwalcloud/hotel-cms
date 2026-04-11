const bcrypt = require('bcrypt');

// Test the password hash from schema.sql
const testHash = '$2b$10$rZ8KnXGCYqFqF6YxN5YgVOZ4L5j3JfXxDNF0mQGy5V6pLqT3k8YSC';
const testPassword = 'Admin@123';

bcrypt.compare(testPassword, testHash).then(isValid => {
    console.log('Password hash validation:');
    console.log('Password:', testPassword);
    console.log('Hash:', testHash);
    console.log('Is valid:', isValid);

    if (!isValid) {
        console.log('\n❌ PROBLEM FOUND: The password hash in schema.sql does NOT match the password "Admin@123"!');
        console.log('Generating correct hash...\n');

        return bcrypt.hash(testPassword, 10);
    }
    return null;
}).then(newHash => {
    if (newHash) {
        console.log('✅ Correct hash for password "Admin@123":');
        console.log(newHash);
        console.log('\nUpdate schema.sql line 342 with this hash.');
    } else {
        console.log('\n✅ Password hash is valid!');
    }
}).catch(err => {
    console.error('Error:', err);
});
