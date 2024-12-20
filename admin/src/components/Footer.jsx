import React from 'react'
import { assets } from '../assets/assets_frontend/assets'

const Footer = () => {
    return (

        <div className='mt-16 '>
            <hr className='mb-4' />
            <div className='flex justify-between'>

                <div className='w-2/3 space-y-6'>
                    <img src={assets.logo} alt="" />
                    <p className='text-sm font-light'>Lorem ipsum dolor sit amet consectetur adipisicing elit nobis, excepturi hic officia! Optio qui quasi explicabo iusto!</p>
                </div>
                <div className='space-y-6'>
                    <p className='text-sm font-light'>
                        COMPANY
                    </p>
                    <ul className='text-sm font-light space-y-1'>
                        <li>Home</li>
                        <li>About us</li>
                        <li>Contact us</li>
                        <li>Private Policies</li>

                    </ul>
                </div>
                <div className='space-y-6'>
                    <p className='text-sm font-light'>GET IN TOUCH</p>
                    <div className='text-sm font-light space-y-1'>

                        <p>965382080</p>
                        <p>mail@gmail.com</p>
                    </div>
                </div>
            </div>
            <div className='mt-5 mb-5 text-sm font-light flex justify-center'>
                Copyright 2024 @Prescripto- All Rights reserved
            </div>
        </div>
    )
}

export default Footer