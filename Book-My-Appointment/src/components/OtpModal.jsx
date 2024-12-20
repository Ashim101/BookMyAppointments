import React, { useRef, useState } from 'react';

const OtpModal = ({ onSubmit }) => {
    const [otp, setOtp] = useState(new Array(6).fill(""));
    const inputRefs = useRef([]);

    const handleChange = (element, index) => {
        const value = element.value;
        console.log("handle change")
        if (/^[0-9]$/.test(value)) {
            const newOtp = [...otp];
            newOtp[index] = value;
            setOtp(newOtp);
            if (index < 5) {
                inputRefs.current[index + 1].focus();
            }
        }
    };

    const handleKeyDown = (e, index) => {
        console.log("handle key down")
        if (e.key === 'Backspace') {
            console.log("backspace")
            const newOtp = [...otp];
            if (!newOtp[index] && index > 0) {
                // If current input is empty, move focus to the previous input
                inputRefs.current[index - 1].focus();
            } else {
                // If there's a value, clear it
                newOtp[index] = "";
                setOtp(newOtp);
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (otp.every((digit) => digit)) {
            onSubmit(otp.join(""));
        } else {
            alert("Please fill in all 6 digits");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                <h3 className="text-lg font-bold mb-4 text-center">Enter OTP</h3>
                <form onSubmit={handleSubmit} className="flex justify-center items-center space-x-2">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            type="text"
                            value={digit}
                            onChange={(e) => handleChange(e.target, index)}
                            onKeyDown={(e) => handleKeyDown(e, index)} // Add keydown handler
                            ref={(el) => inputRefs.current[index] = el}
                            maxLength={1}
                            className="w-12 h-12 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            inputMode="numeric"
                        />
                    ))}
                </form>
                <button
                    onClick={handleSubmit}
                    className="mt-4 w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Verify OTP
                </button>
            </div>
        </div>
    );
};

export default OtpModal;
