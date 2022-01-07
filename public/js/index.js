/*eslint-disable*/

// this file is to get data from the ui and delegate the actions
// import "@babel/polyfill";
// import "core-js/stable";
import "regenerator-runtime/runtime";
import { login, logout } from "./login";
import { updateSettings } from "./updateSettings";
import { displayMap } from "./mapbox";
import { bookTour } from "./stripe";

// DOM ELEMENTS
const mapbox = document.getElementById("map");
const loginForm = document.querySelector(".form--login");
const logoutBottom = document.querySelector(".nav__el--logout");
const userDataForm = document.querySelector(".form-user-data");
const userPasswordForm = document.querySelector(".form-user-password");
const bookBtn = document.getElementById("book-tour");

if (mapbox) {
  const locations = JSON.parse(mapbox.dataset.locations);
  displayMap(locations);
}

if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    console.log(email, password);

    e.preventDefault();
    login(email, password);
  });
}

if (logoutBottom) {
  logoutBottom.addEventListener("click", logout);
}

if (userDataForm) {
  userDataForm.addEventListener("submit", async (e) => {
    // IMPORTANT!! prevent the form from being submitted (to be able to use the API)
    e.preventDefault();

    document.querySelector(".btn--save-settings").textContent = "Updating...";

    // the form is needed to send the photo (multi-part)
    const form = new FormData();
    form.append("name", document.getElementById("name").value);
    form.append("email", document.getElementById("email").value);
    form.append("photo", document.getElementById("photo").files[0]);

    // console.log(form);
    // const name = document.getElementById("name").value;
    // const email = document.getElementById("email").value;

    // updateSettings({ name, email }, "data");
    await updateSettings(form, "data");

    document.querySelector(".btn--save-settings").textContent = "Save settings";

    // to automatically show the new img
    location.reload();
  });
}

if (userPasswordForm) {
  // console.log(" userPasswordForm");
  userPasswordForm.addEventListener("submit", async (e) => {
    // IMPORTANT!! prevent the form from being submitted (to be able to use the API)
    e.preventDefault();

    document.querySelector(".btn--save-password").textContent = "Updating...";
    document.querySelector(".btn--save-password").disabled = true;

    const passwordCurrent = document.getElementById("password-current").value;
    const password = document.getElementById("password").value;
    const passwordConfirm = document.getElementById("password-confirm").value;

    // Since updateSettings is async function, we can use await to wait for it to return, and after that clear the form fields
    await updateSettings(
      { passwordCurrent, password, passwordConfirm },
      "password"
    );

    document.querySelector(".btn--save-password").textContent = "Save password";
    document.querySelector(".btn--save-password").disabled = false;
    document.getElementById("password-current").value = "";
    document.getElementById("password").value = "";
    document.getElementById("password-confirm").value = "";
  });
}

if (bookBtn) {
  bookBtn.addEventListener("click", async (e) => {
    e.target.textContent = "Processing...";
    const { tourId } = e.target.dataset;
    console.log(tourId);
    await bookTour(tourId);
    // e.target.textContent = "Processing...";
  });
}
