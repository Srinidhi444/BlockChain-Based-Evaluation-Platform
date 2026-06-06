const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Your MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI ;

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

async function createAdminUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create Admin
    const admin = await User.create({
      userId: 'ADM2026001',
      name: 'System Administrator',
      email: 'admin@college.edu',
      password: hashedPassword,
      role: 'admin',
      department: 'Administration',
    });
    console.log('✅ Created admin:', admin.userId);

    console.log('\n🎉 Admin user created successfully!');
    console.log('\nLogin Credentials:');
    console.log('Admin: ADM2026001 / admin123');
    console.log('Email:', admin.email);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    if (error.code === 11000) {
      console.error('❌ Admin user already exists!');
    }
  }
}

createAdminUser();
