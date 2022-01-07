/* eslint-disable */
import axios from "axios";
import { showAlert } from "./alerts";

export const login = async (email, password) => {
  console.log("LOGIN");
  console.log(email, password);
  try {
    const res = await axios({
      method: "POST",
      url: "api/v1/users/login",
      data: {
        email,
        password,
      },
    });
    if (res.data.status === "success") {
      showAlert("success", "Logged in successfully!");
      window.setTimeout(() => {
        location.assign("/");
      }, 1500);
    }
    // console.log(res);
  } catch (error) {
    showAlert("error", error.response.data.message);
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: "GET",
      url: "api/v1/users/logout",
    });
    // Manually refreshing the browser, (true) to force a server reload and not from the browser cache
    if (res.data.status === "success") location.reload(true);
  } catch (error) {
    showAlert("error", "Error logging out! Try again.");
  }
};
