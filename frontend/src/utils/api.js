import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from "./constants";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";

const buildApiUrl = (path, params = {}) => {
  const url = new URL(path, API_BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

const getBackendMessage = (data) => {
  if (!data) {
    return "";
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.join(", ");
  }

  return data.message || data.error || "";
};

export const getStoredAuthUser = () => {
  const storedUser = localStorage.getItem(AUTH_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
};

export const clearAuthStorage = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

export const formatDate = (dateValue) =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));

export const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

export const isUnauthorizedError = (error) => error.message.includes("HTTP 401");

export const apiRequest = async (path, options = {}, params = {}) => {
  const url = buildApiUrl(path, params);

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`API request failed: ${url}. ${error.message}`, {
      cause: error,
    });
  }

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `API request failed: ${url}. HTTP ${response.status} - backend returned a non-JSON response.`,
        { cause: error },
      );
    }
  }

  if (!response.ok) {
    const backendMessage = getBackendMessage(data);
    throw new Error(
      `API request failed: ${url}. HTTP ${response.status}${
        backendMessage ? ` - ${backendMessage}` : ""
      }`,
    );
  }

  return data;
};
