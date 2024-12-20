import doctorModel from "../models/doctorModel.js"
import bcrypt from 'bcrypt'

import jwt from 'jsonwebtoken'
import appointmentModel from "../models/appointmentModel.js";


const doctorList = async (req, res) => {

    try {

        const doctors = await doctorModel.find({}).select(["-password,-email"]);
        res.json({ success: true, doctors })
    } catch (e) {
        console.log(e);
        res.json({ success: false, message: "Server error ", e })

    }


}

const doctorLogin = async (req, res) => {

    console.log(req.body)
    console.log("inside doctor login")
    const { email, password } = req.body


    try {
        const doctor = await doctorModel.findOne({ email })

        if (!doctor) {
            return res.json({ success: false, message: "doctor does not exist" });
        }

        // Compare the plain text password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, doctor.password);

        // If the passwords match, generate a JWT
        if (isMatch) {
            const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET_KEY, {
                expiresIn: '1h',
            });
            return res.json({ success: true, token });
        } else {
            return res.json({ success: false, msg: "Credentials do not match" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }



}

const allAppointments = async (req, res) => {
    console.log("inside all appointments of doctor")

    try {
        const appointments = await appointmentModel.find({ docId: req.body.docId })

        return res.json({ success: true, message: appointments })



    } catch (e) {
        console.log(e)
        res.status(500).json({ success: false, message: "Server error", error: e.message });

    }



}

const cancelAppointment = async (req, res) => {


    console.log("inside cancel appointments")

    const { appointment_id } = req.body

    try {
        const appointments = await appointmentModel.findByIdAndUpdate(appointment_id, { cancelled: true })

        return res.json({ success: true, message: "Sucessfully updated" })



    } catch (e) {
        console.log(e)
        res.status(500).json({ success: false, message: "Server error", error: e.message });

    }
}

const finishAppointment = async (req, res) => {

    console.log("inside cancel appointments")

    const { appointment_id } = req.body

    try {
        await appointmentModel.findByIdAndUpdate(appointment_id, { isCompleted: true })

        return res.json({ success: true, message: "Sucessfully updated" })



    } catch (e) {
        console.log(e)
        res.status(500).json({ success: false, message: "Server error", error: e.message });

    }




}


const getDashboardData = async (req, res) => {
    console.log("inside dashboard")



    const { docId } = req.body
    try {


        const appointments = await appointmentModel.find({ docId })

        let earning = 0
        let patients = []



        appointments.map(appointment => {
            if (!patients.includes(appointment.userId)) {
                patients.push(appointment.userId)
            }
            if (appointment.isCompleted || appointment.payment) {
                earning += appointment.amount
            }
        })


        const dashData = {
            appointments: appointments.length,

            patients: patients.length,
            earning,
            latestAppointments: appointments.reverse().slice(0, 5)


        }

        console.log(dashData)

        return res.json({ success: true, message: dashData })



    } catch (e) {
        console.log(e)
        res.status(500).json({ success: false, message: "Server error", error: e.message });

    }



}

const getprofile = async (req, res) => {
    console.log("inside get profile")
    const { docId } = req.body
    try {
        const profile = await doctorModel.findById(docId).select("-password")
        console.log(profile)
        return res.json({ success: true, profile })
    } catch (e) {
        return res.json({ success: false, message: "internal error" })
    }
}
const updateProfile = async (req, res) => {
    console.log("inside update profile")
    console.log(req.body)
    const { address, fees, available } = req.body
    const { docId } = req.body
    try {

        const doc = await doctorModel.findByIdAndUpdate(docId, { address, fees, available })

        console.log("found and updated", doc)
        return res.json({ success: true, message: "Profile updated" })
    } catch (e) {
        return res.json({ success: false, message: "internal error" })
    }
}


export { doctorLogin, doctorList, allAppointments, cancelAppointment, finishAppointment, getDashboardData, getprofile, updateProfile }