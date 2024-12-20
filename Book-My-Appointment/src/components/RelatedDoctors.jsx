import { useSelector } from 'react-redux'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Doctors from './DoctorCards';

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
            <Doctors doctors={doctors.slice(0, 10)} />


        </div>



    )
}

export default RelatedDoctors