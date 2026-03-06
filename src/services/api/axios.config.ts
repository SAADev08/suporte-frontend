import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_KEY_ENV = import.meta.env.VITE_TOKEN_KEY;

const api = axios.create({
    baseURL: BASE_URL,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem(TOKEN_KEY_ENV);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    res => res,
    error => {
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.reload();
        }
        return Promise.reject(error);
    },
);

export default api;
