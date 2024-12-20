import React from 'react';

const CircularSpinner = () => {
    return (
        <div className="flex justify-center items-center">
            <div className="w-16 h-16 border-4  border-gray-200 border-solid rounded-full animate-spin border-t-blue-500"></div>
        </div>
    );
};

export default CircularSpinner;
