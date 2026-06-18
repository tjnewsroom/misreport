import { createContext, useContext, useReducer, useRef } from 'react';

const initialState = {
  me: null,
  emps: [],
  daily: {},
  breaks: {},
  quality: {},
  reliability: {},
  prodDaily: {},
  attendance: {},
  shifts: {},
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ME': return { ...state, me: action.payload };
    case 'SET_EMPS': return { ...state, emps: action.payload };
    case 'SET_ALL': return { ...state, ...action.payload };
    case 'RESET': return { ...initialState };
    case 'SET_DAILY': return { ...state, daily: action.payload };
    case 'SET_BREAKS': return { ...state, breaks: action.payload };
    case 'SET_QUALITY': return { ...state, quality: action.payload };
    case 'SET_RELIABILITY': return { ...state, reliability: action.payload };
    case 'SET_PROD_DAILY': return { ...state, prodDaily: action.payload };
    case 'SET_ATTENDANCE': return { ...state, attendance: action.payload };
    case 'SET_SHIFTS': return { ...state, shifts: action.payload };
    case 'UPDATE_DAILY_ITEM': {
      const { empId, date, items } = action.payload;
      return { ...state, daily: { ...state.daily, [empId]: { ...(state.daily[empId]||{}), [date]: items } } };
    }
    case 'UPDATE_BREAKS': {
      const { empId, date, items } = action.payload;
      return { ...state, breaks: { ...state.breaks, [empId]: { ...(state.breaks[empId]||{}), [date]: items } } };
    }
    case 'UPDATE_PROD_DAILY': {
      const { empId, date, data } = action.payload;
      return { ...state, prodDaily: { ...state.prodDaily, [empId]: { ...(state.prodDaily[empId]||{}), [date]: data } } };
    }
    case 'UPDATE_QUALITY': {
      const { empId, date, data } = action.payload;
      return { ...state, quality: { ...state.quality, [empId]: { ...(state.quality[empId]||{}), [date]: data } } };
    }
    case 'UPDATE_RELIABILITY': {
      const { empId, month, data } = action.payload;
      return { ...state, reliability: { ...state.reliability, [empId]: { ...(state.reliability[empId]||{}), [month]: data } } };
    }
    case 'UPDATE_ATTENDANCE': {
      const { empId, date, data } = action.payload;
      return { ...state, attendance: { ...state.attendance, [empId]: { ...(state.attendance[empId]||{}), [date]: { ...(state.attendance[empId]?.[date]||{}), ...data } } } };
    }
    case 'UPDATE_SHIFT': {
      const { date, empId, data } = action.payload;
      return { ...state, shifts: { ...state.shifts, [date]: { ...(state.shifts[date]||{}), [empId]: data } } };
    }
    case 'ADD_EMP': {
      return { ...state, emps: [...state.emps, action.payload] };
    }
    case 'UPDATE_EMP': {
      return { ...state, emps: state.emps.map(e => e._uuid === action.payload._uuid ? { ...e, ...action.payload } : e) };
    }
    case 'REMOVE_EMP': {
      return { ...state, emps: state.emps.filter(e => e._uuid !== action.payload) };
    }
    default: return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
