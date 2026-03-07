require('dotenv').config();
const User = require('./../models/User');
const connectDB = require('./../config/db');

const seedAdmin = async () => {
  try {
    await connectDB(); 

    const adminData = {
      username: 'admin_ielts',
      email: 'admin@ieltsapp.com',
      password: 'adminpassword123',
      role: 'admin',
      fullName: 'System Admin'
    };

    const adminExists = await User.findOne({ email: adminData.email });
    
    if (!adminExists) {
      await User.create(adminData);
      console.log('Admin account seeded!');
    } else {
      console.log('ℹAdmin already exists.');
    }

    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();