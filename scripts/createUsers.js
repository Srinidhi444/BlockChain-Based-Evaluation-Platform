const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Your MongoDB connection string
const MONGODB_URI = 'mongodb+srv://omgosavi1499_db_user:sXaUxRky5pV4jcai@authh.byhhned.mongodb.net/answer-sheet-evaluation?retryWrites=true&w=majority&appName=authh';

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

async function createTestUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create Student
    const student = await User.create({
      userId: 'ST2026001',
      name: 'Test Student',
      email: 'student@test.com',
      password: hashedPassword,
      role: 'student',
      department: 'Computer Science',
      year: 2,
      division: 'A',
    });
    console.log('✅ Created student:', student.userId);

    // Create Teacher
    const teacher = await User.create({
      userId: 'TCH2026001',
      name: 'Test Teacher',
      email: 'teacher@test.com',
      password: hashedPassword,
      role: 'teacher',
      department: 'Computer Science',
      subjects: ['Data Structures', 'Algorithms', 'DBMS'],
    });
    console.log('✅ Created teacher:', teacher.userId);

    console.log('\n🎉 Test users created successfully!');
    console.log('\nLogin Credentials:');
    console.log('Student: ST2026001 / password123');
    console.log('Teacher: TCH2026001 / password123');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestUsers();
