import { useSelector } from 'react-redux'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RelatedDoctors = ({ docId, speciality }) => {

    const navigate = useNavigate()

    const doctors = useSelector(store => store.doctors);

    const [filterDoctors, setFilterDoctors] = useState([])

    const applyFilter = () => {
        if (speciality) {
            setFilterDoctors(doctors.filter(doc => doc.speciality === speciality && docId != doc._id))

        }
        else {
            setFilterDoctors(doctors)


        }
    }

    useEffect(() => {
        applyFilter();
    }, [docId, speciality])





    return (
        <div>
            <div className='font-semibold my-10 mt-36 text-xl'>
                <p>Related Doctors</p>
                <p className='text-sm font-light'>Simply browse through our experienced doctors</p>
            </div>
            <div className=' grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 '>
                {doctors.slice(0, 10).map((item, index) => (
                    <div onClick={() => navigate(`/appointments/${item._id}`)} className='border-2 hover:translate-y-[-12px] transition-all duration-300 rounded-lg p-[2px] border-slate-400 cursor-pointer flex flex-col items-center '>
                        <div className='bg-slate-100 '>
                            <img src={item.image} alt="" className='w-full  object-contain' />


                        </div>
                        <div className='flex flex-col items-start  gap-1'>
                            <div className='flex mb-3 items-center gap-2 '>

                                <p className={`${item.available ? 'bg-green-500' : 'bg-gray-500'}  h-2 w-2 rounded-full`}></p>
                                <p className={`${item.available ? 'text-green-500' : 'text-gray-500'}  `}>{item.available ? "Available" : "Not Available"}</p>
                            </div>
                            <p className='text-xl font-normal '>{item.name}</p>
                            <p className='font-light'>{item.speciality}</p>


                        </div>

                    </div>

                ))}

            </div>


        </div>

    )
}

export default RelatedDoctors