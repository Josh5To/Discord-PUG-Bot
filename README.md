TOP FROG Discord PUG Bot \n

This is a bot designed to have a little more control over what kind of pickup games you want to run. \n
This will also save matches and results into a db which can be accessed at a later time when the website launches. \n

\n
This is an ongoing project. Version 0.1 will have the ability to start matches of any size, report scores, and confirm scores. \n
\n
Walkthrough: \n
1.) User in voice channel starts match using ".match (x)v(x)" Where (x) is team sizes. (Ex. ".match 3v3") \n
2.) Match will be created, other users in voice chat will user ".ready" if they would like to join and are ready to go. \n
3.) Once the max amount of players are reached, the ".start" command can be used to split of the teams into two or three groups randomly. \n
4.) After game is over, a user should report the scores using ".results (score1)-(score2)" (Ex. ".results 12-4"). \n
5.) Other players in the PUG should use ".confirm" in the same voice channel they started the match in to confirm scores, once
    half of the max players + 1 confirm, match will be automatically ended. \n
\n
Alternatively, admins of the channel can use ".end" to end the match without confirmation. \n

\n
More to come! \n
\n 
node, mongo, discord.js
