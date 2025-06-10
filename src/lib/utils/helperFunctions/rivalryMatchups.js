import { getLeagueData } from "./leagueData"
import { leagueID } from '$lib/utils/leagueInfo';
import { getNflState } from "./nflState"
import { waitForAll } from './multiPromise';
import { getRosterIDFromManagerIDAndYear } from '$lib/utils/helperFunctions/universalFunctions';
import { getLeagueTeamManagers } from "./leagueTeamManagers";

export const getRivalryMatchups = async (userOneID, userTwoID, gameTypes = { regular: true, playoff: true, consolation: true }) => {
    if(!userOneID || !userTwoID) {
        return;
    }

    let curLeagueID = leagueID;

	const [nflState, teamManagers] = await waitForAll(
		getNflState(),
		getLeagueTeamManagers(),
	).catch((err) => { console.error(err); });

	let week = 1;
	if(nflState.season_type == 'regular') {
		week = nflState.display_week;
	} else if(nflState.season_type == 'post') {
		week = 18;
	}

    const rivalry = {
        points: {
            one: 0,
            two: 0,
        },
        wins: {
            one: 0,
            two: 0,
        },
        ties: 0,
        matchups: []
    }

    while(curLeagueID && curLeagueID != 0) {
        const leagueData = await getLeagueData(curLeagueID).catch((err) => { console.error(err); });
        const year = leagueData.season;
        const rosterIDOne = getRosterIDFromManagerIDAndYear(teamManagers, userOneID, year);
        const rosterIDTwo = getRosterIDFromManagerIDAndYear(teamManagers, userTwoID, year);
        if(!rosterIDOne || !rosterIDTwo || rosterIDOne == rosterIDTwo) {
            curLeagueID = leagueData.previous_league_id;
            week = 18;
            continue;
        }

        // Determine which weeks to fetch based on game types
        const weeksToFetch = [];
        const playoffStart = leagueData.settings.playoff_week_start;
        const totalWeeks = 18; // Assuming NFL goes to week 18
        
        if (gameTypes.regular) {
            // Regular season weeks
            for(let i = 1; i < playoffStart; i++) {
                weeksToFetch.push(i);
            }
        }
        
        if (gameTypes.playoff || gameTypes.consolation) {
            // Playoff and consolation weeks (both are in playoff weeks)
            for(let i = playoffStart; i <= totalWeeks; i++) {
                weeksToFetch.push(i);
            }
        }

        // Pull in matchup data for selected weeks
        const matchupsPromises = [];
        for(const weekNum of weeksToFetch) {
            matchupsPromises.push(fetch(`https://api.sleeper.app/v1/league/${curLeagueID}/matchups/${weekNum}`, {compress: true}))
        }
        const matchupsRes = await waitForAll(...matchupsPromises);

        // Convert the json matchup responses
        const matchupsJsonPromises = [];
        for(const matchupRes of matchupsRes) {
            const data = matchupRes.json();
            matchupsJsonPromises.push(data)
            if (!matchupRes.ok) {
                throw new Error(data);
            }
        }
        const matchupsData = await waitForAll(...matchupsJsonPromises).catch((err) => { console.error(err); });

        // Process all the matchups
        for(let i = 0; i < matchupsData.length; i++) {
            const weekNum = weeksToFetch[i];
            const processed = processRivalryMatchups(matchupsData[i], weekNum, rosterIDOne, rosterIDTwo, leagueData.settings, gameTypes);
            if(processed) {
                const {matchup, week, gameType} = processed;
                const sideA = matchup[0];
                const sideB = matchup[1];
                let sideAPoints = sideA.points.reduce((t, nV) => t + nV, 0);
                let sideBPoints = sideB.points.reduce((t, nV) => t + nV, 0);
                rivalry.points.one += sideAPoints;
                rivalry.points.two += sideBPoints;
                if(sideAPoints > sideBPoints) {
                    rivalry.wins.one++;
                } else if(sideAPoints < sideBPoints) {
                    rivalry.wins.two++;
                } else {
                    rivalry.ties++;
                }
                rivalry.matchups.push({
                    week,
                    year,
                    matchup,
                    gameType
                })
            }
        }
        curLeagueID = leagueData.previous_league_id;
        week = 18;
    }

    rivalry.matchups.sort((a, b) => {
        var yearOrder = b.year - a.year;
        var weekOrder = b.week - a.week;
        return yearOrder || weekOrder;
    });

	return rivalry;
}

const processRivalryMatchups = (inputMatchups, week, rosterIDOne, rosterIDTwo, leagueSettings, gameTypes) => {
	if(!inputMatchups || inputMatchups.length == 0) {
		return false;
	}
	
    // Determine game type
    const playoffStart = leagueSettings.playoff_week_start;
    let gameType;
    if (week < playoffStart) {
        gameType = 'regular';
    } else {
        // For playoff weeks, we need to determine if it's playoff or consolation
        // This is a simplified approach - you might need more sophisticated logic
        // based on your league's bracket structure
        gameType = 'playoff'; // Default to playoff, could be enhanced to detect consolation
    }
    
    // Check if this game type should be included
    if (!gameTypes[gameType]) {
        return false;
    }
    
	const matchups = {};
	for(const match of inputMatchups) {
        if(match.roster_id == rosterIDOne || match.roster_id == rosterIDTwo) {
            if(!matchups[match.matchup_id]) {
                matchups[match.matchup_id] = [];
            }
            matchups[match.matchup_id].push({
                roster_id: match.roster_id,
                starters: match.starters,
                points: match.starters_points,
            })
        }
	}
    const keys = Object.keys(matchups);
    const matchup = matchups[keys[0]];
    // if the two teams played each other, there will only be one matchup, or if
    // there is one matchup that only has half the matchup, then one of the teams wasn't in the league yet
    if(keys.length > 1 || matchup.length == 1) {
        return;
    }
    // make sure that the order matches
    if(matchup[0].roster_id == rosterIDTwo) {
        const two = matchup.shift();
        matchup.push(two);
    }
	return {matchup, week, gameType};
}