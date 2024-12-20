import React from 'react'
import { assets } from '../assets/assets_frontend/assets'

const About = () => {
    return (
        <div>

            <div className='text-center my-8'>
                <p>

                    About <span>Us</span>
                </p>
            </div>
            <div className='flex flex-col sm:flex-row gap-10 items-center sm:items-start'>

                <div >
                    <img className=' max-h-52 sm:max-h-fit    ' src={assets.about_image} alt="" />
                </div>

                <div className='text-xs md:text-sm border-2 border-slate-300 rounded-lg p-4 space-y-2'>
                    <p>Welcome to Prescripto, your trusted partner in managing your healthcare needs conveniently and efficiently. At Prescripto, we understand the challenges individuals face when it comes to scheduling doctor appointments and managing their health records.</p>
                    <p>Prescripto is committed to excellence in healthcare technology. We continuously strive to enhance our platform, integrating the latest advancements to improve user experience and deliver superior service. Whether you're booking your first appointment or managing ongoing care, Prescripto is here to support you every step of the way.</p>
                    <p>Our Vision</p>
                    <p>Our vision at Prescripto is to create a seamless healthcare experience for every user. We aim to bridge the gap between patients and healthcare providers, making it easier for you to access the care you need, when you need it.</p>
                </div>




            </div>

            <div className='my-8 space-y-4'>
                <p className='text-xl '>Why chooses Us</p>

                <div className='flex border-2 border-slate-300 rounded-lg px-4 py-4 gap-4'>
                    <div className='space-y-4'>
                        <p className='font-semibold'>Efficiency</p>
                        <p className='text-sm font-light'>Streamlined appointment scheduling that fits into your busy lifestyle.</p>
                    </div>
                    <div className='space-y-4'>
                        <p className='font-semibold'>Convenience</p>
                        <p className='text-sm font-light'>Access to a network of trusted healthcare professionals in your area.</p>
                    </div>
                    <div className='space-y-4'>
                        <p className='font-semibold'>Personalization</p>
                        <p className='text-sm font-light'>Tailored recommendations and reminders to help you stay on top of your health.</p>
                    </div>
                </div>
            </div>


        </div>
    )
}

export default About