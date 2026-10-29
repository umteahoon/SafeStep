import { createContext, useContext } from 'react';

/** 원장 · 강사 사이드바 셸 안에서 그려지는 중인지 (PageHeader 가 로고 · 공통 버튼을 생략하는 데 사용) */
export const InStaffShell = createContext(false);
export const useInStaffShell = () => useContext(InStaffShell);
