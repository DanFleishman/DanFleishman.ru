function calculate_age(dob) {
    var diff_ms = Date.now() - dob.getTime();
    var age_dt = new Date(diff_ms);

    return Math.abs(age_dt.getUTCFullYear() - 2000);
}

var element = document.getElementById("ageBlock");
element.innerHTML = calculate_age(new Date(2004, 6, 28));
