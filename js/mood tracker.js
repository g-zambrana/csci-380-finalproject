import { supabase } from './supabase.js';

const slider = document.getElementById("moodSlider");
const output = document.getElementById("moodValue");
const button = document.querySelector("button");
const moodList = document.getElementById("moodList");

slider.oninput = function () {
    output.textContent = this.value;
};

button.addEventListener("click", async () => {
    const moodValue = slider.value;

    const { data, error } = await supabase
        .from("moods") // <-- change to actual table name
        .insert([{ mood: moodValue }]);

    if (error) {
        console.error("Error inserting:", error);
    } else {
        console.log("Mood saved!");
        loadMoods(); // refresh list
    }
});

// FETCH previous moods
async function loadMoods() {
    const { data, error } = await supabase
        .from("moods") // <-- same table
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching:", error);
        return;
    }

    moodList.innerHTML = "";

    data.forEach(entry => {
        const li = document.createElement("li");
        li.textContent = "Mood: " + entry.mood;
        moodList.appendChild(li);
    });
}

// Load moods when page opens
loadMoods();
