import React from 'react'
import { specialityData } from '../assets/assets_frontend/assets'
import { Link } from 'react-router-dom'

const Speciality = () => {
    return (
        <div >

            <div className="flex flex-col items-center my-10 gap-3 md:gap-5 md:my-20">

                <h1 className='text-xl font-light md:text-3xl'>Search By Speciality</h1>
                <p className='text-sm font-light md:text-xl text-center '>Simply browse through our extensive list of trusted doctors, <br />
                    schedule your appointments hassle-free.</p>
            </div>
            <div className="flex flex-wrap items-center gap-8 justify-center">
                {specialityData.map((item, index) => (<Link onClick={() => { scrollTo(0, 0) }} to={`/doctors/${item.speciality}`} key={index} className='text-xl hover:translate-y-[-12px] transition-all duration-200  font-semibold min-w-44  space-y-3 flex flex-col  items-center md:min-w-16 '>

                    <p> {item.speciality}</p>
                    <div className="">
                        <img src={item.image} alt="" className='h-20 w-auto' />
                    </div>

                </Link>))}

            </div>
        </div>
    )
}

export default Speciality