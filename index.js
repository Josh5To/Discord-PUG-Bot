require('dotenv').config()
const {Client, MessageAttachment, MessageEmbed} = require('discord.js')
const {MongoClient} = require('mongodb');
const client = new Client()
const dbclient = new MongoClient(process.env.URI)

//copied
function create_UUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

//standard "gets" should go here.

//gets match from match id.
getMatch = async (q) => {
    //connect to db
    const db = dbclient.db("play");

    //connect to collection
    const col = db.collection("matches");
    let query = {match_id : q};
    let res = await col.findOne(query);
    if(res === null || !res['active']){
        return false;
    }
    else if(res['active']) {
        return res;
    }
}

endMatch = async (mid) => {
    const db = dbclient.db("play");

    //connect to collection
    const mcol = db.collection("matches");

    await mcol.updateOne(
        {match_id: mid},
        {
            $set: {active: false}
        }
    );
}

//checks for active match with voice channel ID)
checkActiveMatch = async (q) => {
    //connect to db
    const db = dbclient.db("play");

    //connect to collection
    const col = db.collection("matches");
    let query = {channel_id : q,
                 active: true};
    let res = await col.findOne(query);
    if(res === null || !res['active']){
        return false;
    }
    else if(res['active']) {
        return res;
    }
}

playerInMatch = async (q) => {
    //connect to db
    const db = dbclient.db("play");

    //connect to collection
    const col = db.collection("matches");

    let query = {channel_id : q};
    let res = await col.findOne(query);
    if(res === null || !res['active']){
        return false;
    }
    else if(res['active']) {
        return true;
    }
}
//Checks if player is in the current match active in voice server. server_q is the channel ID, id should be player id from message.
playerInMatchServer = async (server_q, id) => {
    //create this bool to change to true if player is found in 
    var inMatch = false;
    //connect to matches db to query with active match in server, later search through "players" array
    let currentMatch = await checkActiveMatch(server_q)
    if (currentMatch) {
        let playerList = currentMatch["players"];
        playerList.forEach(x => {
            if(x['user_id'] === id) {
                inMatch = true;
            }
        });
        return inMatch;
    }
    else {
        return false;
    }

}


dbconnect = async () => {
    try  {
        await dbclient.connect();

    } catch (e) {
        console.error(e);
    } finally {
        //await dbclient.close();
    }
}

//Search DB for user ID.
searchUserID =  async (q) => {
    //connect to db
    const db = dbclient.db("play");
    //connect to collection
    const col = db.collection("players");
    let query = {user_id : q};
    let res = await col.findOne(query);
    if(res === null){
        return 0;
    }
    else {
        return res;
    }
};


//Add user to DB.
addUser = async (id, username) => {
    //connect to db
    const db = dbclient.db("play");
    //connect to collection
    const col = db.collection("players");
    let newUser = {
        user_id: id,
        user_name: username,
        win: 0,
        loss: 0,  
        rank: 1000,
        in_match: false
    }
    try {
        let p = await col.insertOne(newUser)
    }
    catch (e) {
        console.error(e);
    }
    finally {
        console.log("New user added")
    }

}
 
//Used to see if users are in DB, if they aren't it adds them to DB.
//Takes full member object
handleUsers = async (user) => {
    let player = null
    //Goes through each user in voice channel, first checks to see if they are already in db.
    var i = 0;
    try {
        //Sends user id retrieved from discordjs to searchUserID method.
        var f = await searchUserID(user.user.id);
    }
    catch (e) {
        console.error(e);
    }
    finally {
        //Checks for sent ID or undefined if does not exist in DB.
        if(user.user.id === f['user_id']) {
            null
        }
        else {
            try {
                //If no current user is found in db, user is added.
                await addUser(user.user.id, user.user.username)
                //then user is retrieved from query.
                var f = await searchUserID(user.user.id)
            }
            catch (e) {
                console.error(e)
            }
        }
    }
    player = f; 
    return player;
}

//creates initial lobby, sends to DB with "active" tag. returns lobby object.
prepareLobby = async (cid, lid, ts1, ts2) => {
    //channel id is from channel that started match
    let chanID = cid;
    //lobby id is UUID generated on match creation
    let lobbyID = lid;
    //max size is from message from user 1v3=4 4v4=8 etc
    let maxSize = ts1+ts2;
    let lobby = []
    const db = dbclient.db("play");
    const col = db.collection("matches");
    let newMatch = {
        match_id: lobbyID,
        channel_id: chanID,
        team_1_size: ts1,
        team_2_size: ts2,
        max_players: maxSize,
        players: [],
        results: [],
        scoreConf: 0,
        active: true

    }
    try {
        let p = await col.insertOne(newMatch)
    }
    catch (e) {
        console.error(e);
    }
    finally {
        console.log("New Lobby created! Match ID: " + lobbyID)
    }
    return lobby;
}

//Need to only send user ID and username to match to avoid unnecesary data
addUserToMatch = async (user, match) => {
    var dbuser = await handleUsers(user);
    var refUser = {
        user_id: dbuser["user_id"],
        user_name: dbuser["user_name"],
        hasConfirmed: false
    }
    var currentMatch = await getMatch(match);
    //connect to db
    const db = dbclient.db("play");
    //connect to collection for matches
    const pcol = db.collection("players");
    //If amount of players added is less than max players, continue.
    if (currentMatch['players'].length <= (currentMatch['max_players'] - 1)) {
        const mcol = db.collection("matches");
        await mcol.updateOne(
            {match_id: match},
            {
                $push: {players: refUser}
            }
        );
        await pcol.updateOne(
            {user_id : dbuser["user_id"]},
            {
                $set: {
                    in_match: true
                }
            }
        )
    }
    else {
        return 1;
    }

    
}

startMatch = async (m) => {
    //get match based off of match id.
    var match = m;
    //copy array of player objects to new variable (not necessary??)
    var players = match['players'];
    //checks if "match conditions are met" which is the max number of players has joined and this match is active.
    if ((players.length == match['max_players']) && (match['active'])) {
        //two arrays for each team
        var team1 = [];
        var team2 = [];
        //loops through team 1 size
        for (i = 0; i < match['team_1_size']; i++) {
            //gets random number with max value of length of players array
            let ran = randomInt(players.length);
            //pushes chosen player in array to team1 array
            team1.push(players[ran]['user_name']);
            //removes randomly chosen player from players array.
            players.splice(ran, 1);
        }
        //loops through team 2 size, same functions as prior loop.
        for (i = 0; i < match['team_2_size']; i++) {
            let ran = randomInt(players.length);
            team2.push(players[ran]['user_name']);
            players.splice(ran, 1);

        }

        /*
        Constructor for embed discord message.
        color is left line color in message
        title will be the most bold
        description field is not used
        */
        const randomTeam = new MessageEmbed()
            .setColor('#00ff3c')
            .setTitle("Match!")
            .setAuthor('Top Frog')
            .setDescription('')
            .addFields(
                { name: 'Team 1:', value: team1 },
                { name: 'Team 2:', value: team2 }
            )
        return randomTeam;
    }
    else {
        return "Match conditions not met, not enough players."
    }
}
//recieves match and score, updates score in recieved match !! SHOULD CHECK TO MAKE SURE USER IS IN SERVER BEFORE CALLING THIS
reportMatch = async (match, score) => {
    const db = dbclient.db("play");

    //connect to collection for matches
    const mcol = db.collection("matches");

    //matches are given an empty 'results' array by default. This will check if the results array is empty, then proceed to allow the score to be added to results array if it is.
    if (match['results'].length < 2) {
        score.forEach(async x => {    
            await mcol.updateOne(
                {match_id : match["match_id"]},
                {
                    $push: {
                        results: x
                    }
                }
            )
        });
        return null;
    }
    else {
        return match['results'];
    }
}

//recieves a Match(m), adds a match confirmation to the matches "scoreConf" field.
//Also recieved a playerID(pid) in order to change "hasConfirmed to true"
//This is done here as a db connection is already open
confirmMatch = async (m, pid, msg) => {
    const db = dbclient.db("play");

    //connect to collection for matches
    const mcol = db.collection("matches");
    //matches are given an empty 'results' array by default. This will check if the results array is empty, then proceed to allow the score to be added to results array if it is.
    if (m['scoreConf'] < (Math.round(m['players'].length / 2))) {  
        await mcol.updateOne(
            {match_id : m["match_id"],
            'players.user_id': pid
            },
            {
                $inc: {
                    scoreConf: 1
                },
                $set: { "players.$.hasConfirmed" : true },
            }
        );
        return null;
    }
    //this statement fires if this is the last score confirmation needed to continue. End of this statement calls for match to be no longer active.
    else if (m['scoreConf'] === (Math.round(m['players'].length / 2))) {
        await mcol.updateOne(
            {match_id : m["match_id"],
            'players.user_id': pid
            },
            {
                $inc: {
                    scoreConf: 1
                },
                $set: { "players.$.hasConfirmed" : true },
            }
        );
        await endMatch(m['match_id']);
        msg.reply("Score has been confirmed. Match no longer active. GGs!")
    }
}

randomInt = (max) => {
    return Math.floor(Math.random() * Math.floor(max));
}


client.on('message', async msg => {
    //gets location in message where ".match" is said. If it is not the first part of the message, the bot does not get called.
    var vmsg = msg.content.toLowerCase();
    var channelID = msg.member.voice.channelID
    //if ".match" is in beginning of message operations begin.
    if (vmsg.indexOf(".match") == 0) {
        //check if user is in voice channel
        if (msg.member.voice.channel) {
            if(vmsg.charAt(8) === "v") {    
                var channelID = msg.member.voice.channelID;        
                if (!await checkActiveMatch(channelID)) {
                    let lobbyID = create_UUID();
                    let teamSize1 = Number(vmsg.charAt(7));
                    let teamSize2 = Number(vmsg.charAt(9));
                    prepareLobby(channelID, lobbyID, teamSize1, teamSize2)
                }
                else {
                    msg.reply("I'm sorry, it seems this voice channel has an active match. Use .results \"{team1score}-{team2score}\" to report scores.")
                }
            }
        } else {
            msg.reply('You need to join a voice channel first!');
        }
    }
    else {
        console.log("First none")
    }

    //If message starts with ".r", adds user to match (from active voice channel match)
    if (vmsg.indexOf(".ready") == 0) {
        if (msg.member.voice.channel) {
            var channelID = msg.member.voice.channelID;
            var match = await checkActiveMatch(channelID);
            if (match) {
                await addUserToMatch(msg.member, match["match_id"]);
            }          
        } else {
            msg.reply('You need to join a voice channel first!');
        }
    }
    else {
        console.log("Second none")
    }

    //.start can be called when a match is full, allows teams to be split up.
    if (vmsg.indexOf(".start") == 0) {
        if (msg.member.voice.channel) {
            if (await playerInMatchServer(channelID, msg.member.user.id)) {
                var channelID = msg.member.voice.channelID;
                //check active match sees if there is an active match in the channel to start
                var match = await checkActiveMatch(channelID);
                //if checkActiveMatch returns a value, match id is sent to startMatch method.
                if (match) {
                    //this will either return a embed message with teams, or a message stating why.
                    let matchMessage = await startMatch(match);
                    msg.reply(matchMessage);
                }    
                else {
                    msg.reply('Cannot find an active match. Start one using \".match (x)v(x)\".');
                }   
            }   
        } else {
            msg.reply('You need to join a voice channel first!');
        }
    }
    else {
        console.log("Third none")
    }

    if (vmsg.indexOf(".results") == 0) {
        if (msg.member.voice.channel) {
            if (await playerInMatchServer(channelID, msg.member.user.id)) {
                if (vmsg.length > 8) {    
                    let subMsg = vmsg.substring(9, vmsg.length);
                    let score = subMsg.split('-')
                    var match = await checkActiveMatch(channelID);
                    if (match) {
                        //match is already confirmed to exist and be active, so match id can be given directly.
                        try {
                            var xx = await reportMatch(match, score);
                        }
                        catch (e) {
                            console.error(e)
                        }
                        if (xx == undefined) {
                            msg.reply("Looks like the score is: Team 1 ("+score[0]+") and Team 2 ("+score[1]+")." + "\n Other players use .confirm to approve this score.")
                        }
                        else {
                            msg.reply("Looks like score has already been reported as Team 1 ("+xx[0]+") and Team 2 ("+xx[1]+")." + "\n Other players use .confirm to approve this score.")
                        }

                    }
                    else {
                        msg.reply("No active match found")
                    }
                }      
            } 
        } else {
            msg.reply('You need to join a voice channel first!');
        }
    }
    else {
        console.log("fourth none")
    }

    //I feel like this is a mess, need to redo... later
    if (vmsg.indexOf(".confirm") == 0) {
        if (msg.member.voice.channel) {
            var match = await checkActiveMatch(channelID)
            if (match) {
                if (await playerInMatchServer(channelID, msg.member.user.id))   {
                    var playerList = match['players']
                    playerList.forEach(async x => {
                        if (x['user_id'] === msg.member.user.id) {
                            if(!x['hasConfirmed']) {
                                await confirmMatch(match, msg.member.user.id, msg)

                            }
                            else {
                                console.log('Request rejected')
                            }
                        }
                    });
                }   
            }
        } else {
            msg.reply('You need to join a voice channel first!');
        }
    }
    else {
        console.log("fifth none")
    }

    if (vmsg.indexOf(".end") == 0) {
        if (msg.member.hasPermission('ADMINISTRATOR')) {
            if (msg.member.voice.channel) {
                var match = await checkActiveMatch(channelID)
                if (match) {
                    if (await playerInMatchServer(channelID, msg.member.user.id))   {
                        await endMatch(match['match_id'])
                        msg.reply("Current active match cancelled!")
                    }   
                }
            } else {
                msg.reply('You need to join a voice channel first!');
            }
        }
    }
    else {
        console.log("sixth none")
    }
})

dbconnect().catch(console.error);
client.login(process.env.BOT_TOK)