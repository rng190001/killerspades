import "./Games.css";
import { useNavigate } from "react-router-dom";
import { getAllEntriesFromCollection } from "../Firebase.js";
import { getEntriesMatchingField } from "../Firebase.js";
import { isFieldThere } from "../Firebase.js";
import { makeDoc } from "../Firebase.js";
import { convertToDateTime, createDate } from "../Dates.js";
import { updateDocField } from "../Firebase.js";
import io from "socket.io-client";
import 'firebase/compat/firestore';

//const socket = io('http://localhost:3001');
const socket = io(window.location.origin.replace(/^http/, 'ws'));
console.log("Socket" + socket)
console.log("Socket (again) " + window.location.origin.replace(/^http/, 'ws'))


export function GamesList() {
    const navigate = useNavigate();
    function goBack () {
        //sends them back to the profile screen
        navigate("/Profile");
    }

    function registerGame(event) {
        //event.preventDefault();
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const player2Email = document.getElementById('player2Email').value;
        const player3Email = document.getElementById('player3Email').value;
        const player4Email = document.getElementById('player4Email').value;
        const gameName = document.getElementById('gameName').value;

        if(date && time && player2Email && player3Email && player4Email && gameName) {
            const playerEmails = [player2Email, player3Email, player4Email];
            storeGameIntoDB(date, time, playerEmails, gameName)
            playerEmails.forEach(email => socket.emit('sendEmail', email));
            console.log("Game registered!");
        } else {
            alert("Please fill all fields before registering.");
        }
    }

    function storeGameIntoDB(date, time, playerEmails, gameName){
        //console.log(date + " " + typeof(date))
        //console.log(time + " " + typeof(time))
        //console.log(playerEmails)
        //console.log(gameName)
        //const timestamp = firebase.firestore.Timestamp.fromDate(createDate(date, time))
        //const timestamp = Timestamp.fromDate(createDate(date, time));
        const timestamp = createDate(date, time);
        //console.log(timestamp)
        const player2 = playerEmails[0];
        const player3 = playerEmails[1];
        const player4 = playerEmails[2];
        const fieldNames = ["date", "gameName", "player1", "player2", "player3", "player4"]
        const fieldEntries = [timestamp, gameName, localStorage.getItem("email"), player2, player3, player4]
        //console.log("about to store into document")
        makeDoc("Games", fieldNames, fieldEntries)
    }

    function displayGames() {
        getAllGames(localStorage.getItem("email")).then((allGames) => {
            const tableHTML = makeTable(allGames);
            //console.log("This is the tableHTML")
            document.getElementById('myTable').innerHTML = tableHTML;
        });
    }
    

    async function getAllGames(email){
        const gamesQuery = await getAllEntriesFromCollection("Games");
        const gamesArrayArray = await Promise.all(
            Array.from({ length: 4 }, (_, i) => 
                getEntriesMatchingField(gamesQuery, "player" + (i + 1), email)
            )
        );
        return combineArrays(gamesArrayArray);
    }

    //a method to combine the arrays but only the unique ones
    function combineArrays(gamesCollection){
        //we make a set (a data type that doesnt accept duplicates)
        const gameSet = new Set();
        for (let i = 0; i < gamesCollection.length; i++){
            const row = gamesCollection[i];
            for(let j = 0; j< gamesCollection[i].length; j++){
                gameSet.add(gamesCollection[i][j]);
            }
        }
        return gameSet;
    }

    function makeTable(setOfGames){
        const gameArray = Array.from(setOfGames);
        let table = "<table>";
        table += "\n" + makeHeader() + "\n";
        for (let i = 0; i < gameArray.length; i ++){
            const game = gameArray[i].data;
            const gameName = game.gameName;
            const gameDate = convertToDateTime(game.date.seconds, game.date.nanoseconds);
            const player1 = game.player1;
            const player2 = game.player2;
            const player3 = game.player3;
            const player4 = game.player4;
            table += "<tr>\n"
            table += "<td>" + gameName + "</td>"
            table += "<td>" + gameDate + "</td>"
            table += ("<td>" + player1 + ", " 
            + player2 + ", " 
            + player3 + ", " 
            + player4 + "</td>");
            table += "<td><button class='bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded' onclick='joinGame(" + i + ")'>Join Game</button></td>";
            table += "</tr>\n";
        }
        table += "</table>"
        return table
    }
    function makeHeader(){
        return "<tr><td>Game Name</td><td>Game Date</td><td>Game Players</td><td>Join</td></tr>"
    }
    
    window.joinGame = function (rowIndex){
        // Your code to handle the join game action
        console.log("Joining game at row: " + rowIndex);
        getAllGames(localStorage.getItem("email")).then((allGames) => {
            const gameArray = Array.from(allGames);
            console.log(gameArray)
            const game = gameArray[rowIndex]
            const gameRef = game.ref
            console.log(game)
            console.log(gameRef)
            isFieldThere(game.data, "gameCode").then((fieldBoolean) =>{
                if(fieldBoolean){
                    console.log("Field is there")
                    const gameCode = game.data.gameCode;
                    console.log("Gamecode is: " + gameCode)
                    console.log("And now I'm printing the array")
                    navigate("/GameRoom/" + gameCode)
                }
                else{
                    /*socket.current.emit('Generate Room');
                    socket.current.on('newRoomLink', (roomLink) => {
                    // Extract the game code from the room link
                    const gameCode = roomLink.split('/').pop();
                    */
                    const gameCode = Math.random().toString(36).substring(2, 7);
                    // Update the document with the new game code
                    updateDocField(gameRef, "gameCode", gameCode);
                    navigate("/GameRoom/" + gameCode)
                                   
                    
                }
            })
            
        });
    }

    return (
    <>
    <p className="px-4">
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <h1 className="text-2xl font-semibold py-2">Game Registration</h1>
    </p>
  

    <div id="games"></div>

    
    <div className="px-4">  
        <form id="gameForm">
            <input type="date" id="date" placeholder="Date Inputted from Calendar" /> <br />
            <input type="time" id="time" placeholder="Desired Time" /> <br />
            <h2 className="text-slate-600">Player 1: {localStorage.getItem("email")}</h2>
            <input type="email" id="player2Email" placeholder ="Player 2 Email" /> <br />
            <input type='email' id='player3Email' placeholder ='Player 3 Email' /> <br />
            <input type='email' id='player4Email' placeholder ='Player 4 Email' /> <br /> 
            <input type='text' id='gameName' placeholder ='Game Name' /> <br /> 
            <h1 className="py-5">
                <button  className="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded" onClick={registerGame}>Register Game</button>
            </h1> 
            
        </form>
        <h1 className="py-7">
                <button  className="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded" onClick={displayGames}>Click me to get games!</button>
        </h1> 
        <div id="myTable"></div>
        <h1 className="py-6">
                <button  className="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded" onClick={goBack}>Go Back</button>
        </h1> 
    </div>
    </>
    )



}