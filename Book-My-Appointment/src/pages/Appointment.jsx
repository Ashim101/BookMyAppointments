import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { assets } from '../assets/assets_frontend/assets';
import RelatedDoctors from '../components/RelatedDoctors';
import { toast } from 'react-toastify';
import axios from 'axios';
import { doctorActions } from '../store/DoctorSlice';

const Appointment = () => {
    const { docId } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Redux state selectors
    const { backendUrl, token } = useSelector(store => store.settings);
    const doctors = useSelector(store => store.doctors);

    const [docInfo, setDocInfo] = useState(null);
    const [docSlots, setDocSlots] = useState([]);
    const [slotIndex, setSlotIndex] = useState(0);
    const [slotTime, setSlotTime] = useState(null);

    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // Fetch doctors list if not available
    const fetchDoctors = async () => {
        try {
            const response = await axios.get(`${backendUrl}api/doctor/list`);
            if (response.data.success) {
                dispatch(doctorActions.initializetheDoctors(response.data.doctors));
            } else {
                console.loge.loge.loge.loge.log("Failed to load doctors");
            }
        } catch (error) {
            console.loge.loge.loge.loge.loge.log("Error fetching doctors", error);
        }
    };

    useEffect(() => {
        const selectedDoctor = doctors.find(doc => doc._id === docId);
        setDocInfo(selectedDoctor);
    }, [docId, doctors]);

    // Generate available slots for the next 7 days
    const generateAvailableSlots = () => {
        let slots = [];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            let currentDate = new Date(today);
            currentDate.setDate(today.getDate() + i);
            let endTime = new Date(currentDate).setHours(21, 0, 0, 0);

            // Start slot generation logic based on current date
            currentDate.setHours(currentDate.getDate() === today.getDate() && currentDate.getHours() >= 10 ? currentDate.getHours() + 1 : 10);
            currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0);

            let dailySlots = [];
            while (currentDate < endTime) {
                const formattedTime = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const slotDate = `${currentDate.getDate()}_${currentDate.getMonth() + 1}_${currentDate.getFullYear()}`;
                const isSlotAvailable = !docInfo?.slots_booked?.[slotDate]?.includes(formattedTime);

                if (isSlotAvailable) {
                    dailySlots.push({
                        datetime: new Date(currentDate),
                        time: formattedTime,
                    });
                }
                currentDate.setMinutes(currentDate.getMinutes() + 30);
            }
            slots.push(dailySlots);
        }
        setDocSlots(slots);
    };

    useEffect(() => {
        if (docInfo) generateAvailableSlots();
    }, [docInfo]);

    if (!docInfo) {
        return <p>Loading doctor information...</p>;
    }

    // Booking appointment logic
    const bookAppointment = async () => {
        if (!token) {
            toast.warn("Please Login to book an appointment");
            navigate("/login");
            return;
        }

        if (!docSlots[slotIndex]?.[0]) {
            toast.warn("Please select a valid slot.");
            return;
        }

        const selectedDate = docSlots[slotIndex][0].datetime;
        const slotDate = `${selectedDate.getDate()}_${selectedDate.getMonth() + 1}_${selectedDate.getFullYear()}`;

        try {
            const { data } = await axios.post(`${backendUrl}api/user/book-appointment`, { docId, slotDate, slotTime }, {
                headers: { token }
            });

            if (data.success) {
                toast.success(data.message);
                fetchDoctors();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            const errorMessage = error.response ? error.response.data.message : "Something went wrong. Please try again.";
            toast.error(errorMessage);
        }
    };

    return (
        <div>
            {/* Doctor Information */}
            <div className="flex flex-col items-center  sm:flex-row gap-8 text-sm sm:text-base mt-8 justify-center">
                <div className="bg-primary  rounded-lg">
                    <img src={docInfo.image} alt="Doctor" className="max-h-64  sm:max-h-72object-contain " />
                </div>
                <div className="px-3 py-2 border-2 flex items-center flex-col border-slate-300 rounded-lg space-y-4 text-gray-800 pt-8 pl-3  w-full sm:w-1/2">
                    <div className="flex items-center  gap-4  ">
                        <p className="text-2xl font-semibold text-gray-800">{docInfo.name}</p>
                        <img src={assets.verified_icon} alt="Verified" />
                    </div>
                    <div className="flex gap-5">
                        <p>{docInfo.degree} - {docInfo.speciality}</p>
                        <button disabled className="border-2 border-slate-500 text-gray-500 rounded-lg px-1">
                            {docInfo.experience}
                        </button>
                    </div>
                    <p>{docInfo.about}</p>
                    <p>Appointment fees - ${docInfo.fees}</p>
                </div>
            </div>

            {/* Booking Slots */}
            <div className="booking-slots mt-10 space-y-5 text-center">
                <p className="font-semibold w-1/4 mx-auto">Booking slots</p>
                <div className="slots flex flex-wrap gap-4 mt-4 justify-center cursor-pointer text-sm sm:text-base">
                    {docSlots.length > 0 && docSlots.map((daySlots, index) => (
                        daySlots.length > 0 && (
                            <div key={index} onClick={() => setSlotIndex(index)} className={`border-2 border-slate-300 rounded-full px-3 hover:bg-primary hover:text-white flex flex-col items-center py-3 ${slotIndex === index ? "bg-primary text-white" : ""}`}>
                                <p>{daysOfWeek[daySlots[0].datetime.getDay()]}</p>
                                <p>{daySlots[0].datetime.getDate()}</p>
                            </div>
                        )
                    ))}
                </div>

                {docSlots.length > 0 && docSlots[slotIndex] && (
                    <div className="flex gap-4 text-sm overflow-x-scroll scrollbar-hide justify-center">
                        {docSlots[slotIndex].map((slot, index) => (
                            <div key={index} className={`hover:bg-primary hover:text-white border-2 border-slate-300 rounded-full px-4 py-1 min-w-28 cursor-pointer ${slotTime === slot.time ? "bg-primary text-white" : ""}`}>
                                <p onClick={() => setSlotTime(slot.time)}>{slot.time.toLowerCase()}</p>
                            </div>
                        ))}
                    </div>
                )}

                <button onClick={bookAppointment} className="bg-primary text-white rounded-xl px-3 py-3">
                    Book An Appointment
                </button>

                <RelatedDoctors speciality={docInfo.speciality} docId={docId} />
            </div>
        </div>
    );
};

export default Appointment;
