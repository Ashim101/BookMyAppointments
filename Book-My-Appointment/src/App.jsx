import './App.css'
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Doctor from './pages/Doctor';
import MyAppointments from './pages/MyAppointments';
import Myprofile from './pages/Myprofile';
import Login from './pages/Login';
import Appointment from './pages/Appointment';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <div className="mx-4 md:mx-[10%]">
      {/* Wrapping Routes inside Router */}
      <Router>
        <Navbar />
        <hr className='m-4' />

        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/about' element={<About />} />
          <Route path='/contact' element={<Contact />} />
          <Route path='/doctors' element={<Doctor />} />
          <Route path='/my-appointments' element={<MyAppointments />} />
          <Route path='/my-profile' element={<Myprofile />} />
          <Route path='/login' element={<Login />} />
          <Route path='/appointments/:docId' element={<Appointment />} />
          <Route path='/doctors/:speciality' element={<Doctor />} />
        </Routes>
        <Footer />
      </Router>
      <ToastContainer />

    </div>
  );
}

export default App;
