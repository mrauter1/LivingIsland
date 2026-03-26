import { Navigate, Route, Routes } from "react-router-dom";
import { ShellRoute } from "./ShellRoute";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ShellRoute />} path="/" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
