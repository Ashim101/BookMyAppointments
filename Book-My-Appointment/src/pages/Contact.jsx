import React from 'react'
import { assets } from '../assets/assets_frontend/assets'

const Contact = () => {
    return (
        <div>
            <p className='text-center text-xl '>Contact Us</p>
            <div className='flex flex-col sm:flex-row text-xl justify-center items-center gap-20 mt-14'>

                <div className=' flex justify-center  '>
                    <img className=' max-h-52 md:max-h-60  ' src={assets.contact_image} alt="" />

                </div>

                <div className='space-y-4 text-base'>
                    <p className='font-semibold'>
                        Our Office
                    </p>
                    <div className='text-base'>
                        <p>54709 Willms Station </p>
                        <p>Suite 350, Washington, USA</p>
                    </div>
                    <div>
                        <p>Tel: (415) 555‑0132</p>
                        <p>Email: greatstackdev@gmail.com</p>
                    </div>
                    <p>Careers at PRESCRIPTO</p>
                    <p>Learn more about our teams and job openings.</p>

                    <button className='border-2 border-slate-400 px-3 py-3 rounded-lg'>Explore jobs</button>

                </div>
            </div>
        </div>
    )
}

export default Contact