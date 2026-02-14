const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Your MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kulkarnisrinidhi85_db_user:Mj1LFKs7Roq2UD06@cluster0.rfw99uc.mongodb.net/';

// User Schema (simplified)
const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
  department: String,
  year: Number,
  division: String,
  subjects: [String],
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function addMoreTeachers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create Teacher 2
    const teacher2 = await User.create({
      userId: 'TCH2026002',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@test.com',
      password: hashedPassword,
      role: 'teacher',
      department: 'Computer Science',
      subjects: ['Data Structures', 'Algorithms', 'DBMS'],
    });
    console.log('✅ Created teacher 2:', teacher2.userId, '-', teacher2.name);

    // Create Teacher 3
    const teacher3 = await User.create({
      userId: 'TCH2026003',
      name: 'Priya Sharma',
      email: 'priya.sharma@test.com',
      password: hashedPassword,
      role: 'teacher',
      department: 'Computer Science',
      subjects: ['Data Structures', 'Algorithms', 'DBMS'],
    });
    console.log('✅ Created teacher 3:', teacher3.userId, '-', teacher3.name);

    console.log('\n🎉 Additional teachers created successfully!');
    console.log('\n📚 All Computer Science Teachers:');
    console.log('1. TCH2026001 - Test Teacher');
    console.log('2. TCH2026002 - Rajesh Kumar');
    console.log('3. TCH2026003 - Priya Sharma');
    console.log('\n🔑 Login Credentials (all teachers):');
    console.log('Password: password123');
    console.log('Email format: [teacher email from above]');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('⚠️  Duplicate user detected. Teachers might already exist.');
    }
    await mongoose.disconnect();
  }
}

addMoreTeachers();
