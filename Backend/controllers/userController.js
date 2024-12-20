
import validator from 'validator'
import { v2 as cloudinary } from 'cloudinary'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'

import bcrypt from 'bcrypt'
import userModel from '../models/userModel.js';
import doctorModel from '../models/doctorModel.js';
import appointmentModel from '../models/appointmentModel.js';
import { OAuth2Client } from 'google-auth-library';
import otpModel from '../models/OTPModel.js'
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


const transporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    },
});

const googleAuth = async (req, res) => {
    const { token } = req.body;
    console.log("inside google auth")

    try {
        // Verify the Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app
        });
        const payload = ticket.getPayload();
        console.log(payload)

        // Check if user exists in your database, if not create a new one
        let user = await userModel.findOne({ email: payload.email });
        if (!user) {
            user = new userModel({
                name: payload.name,
                email: payload.email,
                googleid: payload.sub, // Save Google User ID
            });
            await user.save();
        }

        // Generate your app's JWT token
        const appToken = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });

        res.json({ success: true, token: appToken });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Google authentication failed' });
    }
};

const generateOtp = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({ success: false, message: "Please enter an email" });
    }

    try {
        // Generate a random 6-digit OTP
        const existinguser = await userModel.findOne({ email })
        if (existinguser) {

            return res.json({ success: false, message: "User already exist" })
        }
        const otp = Math.floor(100000 + Math.random() * 900000); // Generates a number between 100000 and 999999

        // Check if the email already exists (optional: you can delete the old OTP or keep it)
        const existingOTP = await otpModel.findOne({ email });
        if (existingOTP) {
            // Remove old OTP for this email
            await otpModel.deleteOne({ email });
        }

        // Create a new OTP entry
        const newOtp = new otpModel({
            email: email,
            otp
        });

        // Save the OTP to the database
        await newOtp.save();

        const mailOption = {
            from: process.env.EMAIL,
            to: email,
            subject: "OTP Validation",
            text: `OPT-${otp}`
        }

        transporter.sendMail(mailOption, (error, info) => {
            if (error) {
                return res.json({ success: false, message: error })
            }
            else {
                return res.json({
                    success: true,
                    message: "OTP sent through email"
                });

            }
        })


        // Respond with success

    } catch (error) {
        return res.json({
            success: false,
            message: "Error generating OTP, please try again later",
        });
    }
};

const verifyOtp = async (req, res) => {
    const { email, otp } = req.body
    try {
        const found = await otpModel.findOne({
            email
        })
        if (!found) {
            return res.json({ success: false, message: "Email not found. Please try again" })
        }
        if (found.otp !== Number(otp)) {
            return res.json({ success: false, message: "OTP didnot matched. Please try again." })
        }
        await otpModel.findOneAndDelete({ email })

        return res.json({ success: true, message: "Welcome to Prescriptio" })


    } catch (error) {
        return res.json({ success: false, message: "Something went wrong. Please try again" })

    }
}

const registerUser = async (req, res) => {
    const {
        name, email, password
    } = req.body;
    try {





        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }


        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email" });


        }
        if (!validator.isStrongPassword(password)) {

            return res.status(400).json({ success: false, message: "Please enter a strong password" });


        }

        const existingDoctor = await userModel.findOne({ email });
        if (existingDoctor) {
            return res.json({ success: false, message: "User with this email already exists" });

        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        //uplad image to cloudinary
        // const imgfile = req.file




        // const img = await cloudinary.uploader.upload(imgfile.path)


        // Create a new doctor
        const newUser = new userModel({
            name,
            email,
            password: hashedPassword,

        });

        console.log(newUser)
        // Save the new doctor to the database
        await newUser.save();
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: '1h',
        })

        return res.status(201).json({ success: true, message: "User added successfully", token });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};



const userLogin = async (req, res) => {
    try {


        const { email, password } = req.body;

        // Find user by email (await is necessary since it's asynchronous)
        const user = await userModel.findOne({ email });

        // Check if user exists
        if (!user) {
            return res.json({ success: false, message: "User does not exist" });
        }

        // Compare the plain text password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);

        // If the passwords match, generate a JWT
        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
                expiresIn: '1h',
            });
            return res.json({ success: true, token });
        } else {
            return res.json({ success: false, message: "Credentials do not match" });
        }
    } catch (error) {
        console.log("Error during login:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getProfile = async (req, res) => {
    const { id } = req.body
    try {

        const userData = await userModel.findById(id).select("-password")
        if (userData) {
            res.json({ userData })
        }
    } catch (e) {
        console.log("Error during login:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }

}

const updateProfile = async (req, res) => {
    const { name, dob, phone, address, id } = req.body;
    const imageFile = req.file; // Image file from request

    // Log the request body and file
    console.log("Request Body:", req.body);
    console.log("Image File:", imageFile);

    // Check if required fields are present
    if (!name || !dob || !phone || !address || !id) {
        console.log("Missing fields:", { name, dob, phone, address, id });
        return res.json({ success: false, message: "All fields are required" });
    }

    try {
        // Log before initializing updated data
        console.log("Initializing updatedData with basic fields");

        // Initialize an update object with the basic fields
        const updatedData = {
            name,
            dob,
            phone,
            address: JSON.parse(address) // Parse the address as it's sent as a string
        };

        // Log the parsed updated data
        console.log("Updated Data:", updatedData);

        // If there's an image file, upload to Cloudinary and add to updatedData
        if (imageFile) {
            console.log("Uploading image to Cloudinary...");
            const uploadedImage = await cloudinary.uploader.upload(imageFile.path); // Assuming the image is sent in `req.file`

            // Log the uploaded image URL
            console.log("Uploaded Image URL:", uploadedImage.secure_url);

            updatedData.image = uploadedImage.secure_url; // Save the uploaded image URL
        }

        // Log before updating the user
        console.log("Finding and updating user with ID:", id);

        // Find the user by ID and update their profile
        const user = await userModel.findByIdAndUpdate(id, updatedData, { new: true }); // `new: true` returns the updated document

        if (!user) {
            console.log("User not found for ID:", id);
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Log successful update
        console.log("Profile updated successfully:", user);

        // Successfully updated the profile
        res.json({ success: true, message: "Profile updated successfully", user });

    } catch (error) {
        // Log any error that occurs
        console.log("Error during profile update:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const bookAppointment = async (req, res) => {
    try {
        const { docId, slotDate, slotTime } = req.body
        const userId = req.body.id

        const docData = await doctorModel.findById(docId).select("-password")

        if (!docData.available) {
            return res.json({ success: false, message: "Doctor not availble" })
        }
        let slots_booked = docData.slots_booked

        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: "Slot not available" })
            }
            else {
                slots_booked[slotDate].push(slotTime)
            }
        }
        else {
            slots_booked[slotDate] = [];
            slots_booked[slotDate].push(slotTime)

        }


        const userData = await userModel.findById(userId).select("-password")
        delete docData.slots_booked;
        console.log(userData, docData)
        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            slotDate,
            slotTime,
            amount: docData.fees,
            date: Date.now()


        }

        const newappointment = new appointmentModel(appointmentData);
        await newappointment.save()

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        res.json({ success: true, message: "Appointment Booked" })

    } catch (error) {
        // Log any error that occurs
        console.log("Error during profile update:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}


const listAppointments = async (req, res) => {
    const { id } = req.body
    console.log("inside apointments")

    try {

        const appointments = await appointmentModel.find({ userId: id })
        res.json({ success: true, appointments })
        console.log("found and sent")

        return

    } catch (e) {
        console.loge.log("Error during profile update:", e);
        return res.status(500).json({ success: false, message: e });
    }


}


const cancelAppointment = async (req, res) => {
    try {

        const { appointmentId, id } = req.body
        const userId = id;
        const appointmentData = await appointmentModel.findById(appointmentId)
        if (appointmentData.userId != userId) {
            return res.status(401).json({ success: false, message: "Please select your own appointment" })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

        const docId = appointmentData.docId

        const docData = await doctorModel.findById(docId)
        const slots_booked = docData.slots_booked

        slots_booked[appointmentData.slotDate] = docData.slots_booked[appointmentData.slotDate].filter(e => e != appointmentData.slotTime)
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        return res.json({ success: true, message: "Appointment cancelled successfully" })
    } catch (e) {
        console.loge.log("Error during profile update:", e);
        return res.status(500).json({ success: false, message: e });

    }
}


export { userLogin, registerUser, getProfile, updateProfile, bookAppointment, listAppointments, cancelAppointment, googleAuth, generateOtp, verifyOtp };