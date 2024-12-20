import validator from 'validator'
import { v2 as cloudinary } from 'cloudinary'
import jwt from 'jsonwebtoken'

import doctorModel from '../models/doctorModel.js';
import bcrypt from 'bcrypt'
import { json } from 'express';
import appointmentModel from '../models/appointmentModel.js';
import userModel from '../models/userModel.js';
const addDoctor = async (req, res) => {
    try {
        const {
            name, email, speciality, degree, experience,
            about, available, fees, address, password
        } = req.body;




        if (!name || !email || !speciality || !degree || !experience || !about || available === undefined || !fees || !address || !password) {

            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        if (!req.file) {

            return res.status(400).json({ success: false, message: "Please upload an image" });
        }


        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email" });


        }
        if (!validator.isStrongPassword(password)) {

            return res.status(400).json({ success: false, message: "Please enter a strong password" });


        }

        const existingDoctor = await doctorModel.findOne({ email });
        if (existingDoctor) {
            return res.status(400).json({ success: false, message: "Doctor with this email already exists" });

        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        //uplad image to cloudinary
        const imgfile = req.file

        let img = null



        if (imgfile) {
            img = await cloudinary.uploader.upload(imgfile.path)
        }


        // Create a new doctor
        const newDoctor = new doctorModel({
            name,
            email,
            image: img ? img.secure_url : "https://media.istockphoto.com/id/1495088043/vector/user-profile-icon-avatar-or-person-icon-profile-picture-portrait-symbol-default-portrait.jpg?s=1024x1024&w=is&k=20&c=oGqYHhfkz_ifeE6-dID6aM7bLz38C6vQTy1YcbgZfx8=",
            speciality,
            degree,
            experience,
            about,
            available,
            password: hashedPassword,
            fees,
            address: JSON.parse(address),
            date: Date.now()
        });

        // Save the new doctor to the database
        await newDoctor.save();

        return res.status(201).json({ success: true, message: "Doctor added successfully", doctor: newDoctor });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


const adminLogin = (req, res) => {

    const { email, password } = req.body

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ email, password }, process.env.JWT_SECRET_KEY, {
            expiresIn: '1h',
        });
        return res.json({ success: true, token })

    }
    else {
        return res.json({ success: false, msg: "Credentials doesnot match" })
    }


}

const allDoctors = async (req, res) => {
    try {
        const doctors = await doctorModel.find({}).select('-password');
        return res.json({ success: true, doctors })
    }
    catch (e) {
        res.status(500).json({ success: false, message: "Server error", error: err.message });

    }

}

const changeAvailability = async (req, res) => {
    const { id } = req.body
    try {
        const docData = await doctorModel.findById(id)
        await doctorModel.findByIdAndUpdate(id, { available: !docData.available });
        res.json({ success: true, message: "Availability changed" })


    } catch (e) {
        res.status(500).json({ success: false, message: "Server error", error: e.message });
    }

}



const allAppointments = async (req, res) => {

    try {
        const appointments = await appointmentModel.find({})

        return res.json({ success: true, message: appointments })



    } catch (e) {
        res.status(500).json({ success: false, message: "Server error", error: e.message });

    }



}

const cancelAppointment = async (req, res) => {

    const { appointment_id } = req.body

    try {
        const appointments = await appointmentModel.findByIdAndUpdate(appointment_id, { cancelled: true })

        return res.json({ success: true, message: "Sucessfully updated" })



    } catch (e) {
        console.log(e)
        res.status(500).json({ success: false, message: "Server error", error: e.message });

    }



}

const getDashboardData = async (req, res) => {
    console.log("inside dashboard")



    try {
        const doctors = await doctorModel.find({})
        const users = await userModel.find({})

        const appointments = await appointmentModel.find({})

        const dashData = {
            doctors: doctors.length,

            patients: users.length,
            appointments: appointments.length,
            latestAppointments: appointments.reverse().slice(0, 5)


        }

        return res.json({ success: true, message: dashData })



    } catch (e) {
        console.log(e)
        res.status(500).json({ success: false, message: "Server error", error: e.message });

    }



}




export { addDoctor, adminLogin, allDoctors, changeAvailability, allAppointments, cancelAppointment, getDashboardData };