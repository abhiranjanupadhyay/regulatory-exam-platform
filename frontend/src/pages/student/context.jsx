import { createContext, useContext } from 'react';

export const StudentContext = createContext(null);
export const useStudent = () => useContext(StudentContext);
