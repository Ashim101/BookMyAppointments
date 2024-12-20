import React from 'react';
import { assets } from '../assets/assets_frontend/assets';

const Header = () => {
    return (
        <div className='flex bg-primary rounded-lg items-center p-8 px-14'> {/* Padding for better spacing */}
            {/* Text Content */}
            <div className=' space-y-8'> {/* Allow this to take remaining space */}
                <h1 className='text-3xl md:text-4xl text-white font-bold'> {/* Increased font size for title */}
                    Book Appointment <br /> With Trusted Doctors
                </h1>
                <div className='flex flex-wrap  gap-2'>
                    <img src={assets.group_profiles} alt="Doctors" className=' w-1/3 md:h-1/2 md:w-auto' />
                    <p className='text-sm font-semibold text-white'>
                        Simply browse through our extensive list of trusted doctors, <br className='hidden md:block' />
                        schedule your appointments hassle-free.
                    </p>
                </div>

                <a href="#speciality" onClick={() => scrollTo({
                    top: 700,
                    left: 0,
                    behavior: 'smooth'
                })} className='inline-flex items-center text-xs sm:text-xl md:text-2xl bg-white text-primary rounded-lg px-4 py-2 mt-4 hover:scale-105 transition-all duration-300 '> {/* Styled button */}

                    Book Appointment <img src={assets.arrow_icon} alt="Arrow" className='ml-2 w-3' />
                </a>
            </div>

            {/* Image Section */}
            <div > {/* Prevent flex from influencing width */}
                <img src={assets.header_img} alt="Doctors" className='hidden sm:block sm:w-full' /> {/* Ensure the image fits correctly */}

            </div>
        </div>
    );
}

export default Header;
