import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import AddDoctor from './pages/AddDoctor';
import Appointments from './pages/Appointments';
import DoctorList from './pages/DoctorList';
import LoginPage from './pages/adminDoctorlogin';
import { useSelector } from 'react-redux';
import Sidebar from './components/Sidebar';
import DoctorSidebar from './components/DoctorSideBar'
import DoctorDashBoard from './pages/DoctorDashboard';
import DoctorProfile from './pages/DoctorProfile';
import DoctorAppointment from './pages/DoctorAppointment';
import WrapperPage from './pages/wrapperPage';


function App() {

  const { adminToken } = useSelector(store => store.settings);
  const { doctorToken } = useSelector(store => store.doctor)

  return (
    <Router> {/* Ensure the Router always wraps the entire app */}
      {adminToken || doctorToken ? (
        <div className="mx-4 md:mx-[3%]">
          <Navbar />
          <hr className='m-4' />

          <div className="flex min-h-screen bg-gray-50">
            {/* Sidebar */}

            {
              adminToken ? <Sidebar /> : <DoctorSidebar />}

            {/* Main Content Area */}
            <div className="w-full"> {/* Adjust for sidebar on larger screens */}
              <div className="p-6">
                {adminToken ?
                  <WrapperPage>

                    <Routes>
                      <Route path='/Dashboard' element={<Dashboard />} />
                      <Route path='/add-doctor' element={<AddDoctor />} />
                      <Route path='/appointments' element={<Appointments />} />
                      <Route path='/doctorlist' element={<DoctorList />} />
                      {/* Redirect to Dashboard or another default page if needed */}
                    </Routes>
                  </WrapperPage>

                  : doctorToken ?


                    <Routes>
                      <Route path='/Dashboard' element={<DoctorDashBoard />} />
                      <Route path='/appointments' element={<DoctorAppointment />} />
                      <Route path='/profile' element={<DoctorProfile />} />
                      {/* Redirect to Dashboard or another default page if needed */}
                    </Routes>
                    :

                    <Routes>
                      <Route path='/' element={<LoginPage />} />

                    </Routes>



                }
              </div>
            </div>
          </div>

          {<Footer />}
        </div>
      ) : (
        <Routes>
          {/* Ensure LoginPage is also wrapped inside the Router */}
          <Route path='/' element={<LoginPage />} />
        </Routes>
      )}
    </Router>
  );
}

export default App;
