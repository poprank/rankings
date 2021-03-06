// All elo ratings need a kFactor. A low kFactor could result in Ratings updating slowly, whereas
// a high one can result in volatility
const exponentDenominator = 400;
const exponentBase = 10;
const kFactorStatic = 32;
const kFactorDecayingStatic = 10;
const kFactorDecayingVariableCoefficient = 40;

/**
 * Calculate player1's expected outcome for a game between players of rating1 and rating2.
 *
 * Article that explains the two main ELO functions
 * https://www.hackerearth.com/blog/developers/elo-rating-system-common-link-facemash-chess/#:~:text=That%20equation%20is%20called%20the%20Elo%20rating%20or,and%20American%20football.%20Elo%20believed%20in%20the%20following%3A
 * @param rating1
 * @param rating2
 * @returns
 */
const calculateExpectedOutcome = (rating1: number, rating2: number): number =>
    (1.0 / (1.0 + Math.pow(exponentBase, ((rating2 - rating1) / exponentDenominator))));

/**
 * Calculate the decaying K factor. When 0 rounds have been played, our k factor is static + variable.
 * As roundsPlayed goes to infinite, the variable component goes to 0.
 * @param roundsPlayed
 * @returns Decayed k factor
 */
const kFactorScaled = (roundsPlayed: number) =>
    (kFactorDecayingStatic + kFactorDecayingVariableCoefficient / Math.sqrt((roundsPlayed + 1)));

/**
 * Get the new rating for a player.
 * @param actual actual outcome - for our win/lose game, it's 1/0, for other games that have scores it can be different
 * @param expected expected outcome - eg if someone has a 90% chance of winning, their expected outcome is 0.9
 * @param rating rating of the player in question
 * @param useDecayingKFactor whether we want to use a K factor that decays as more rounds have been played
 * @returns the new rating for the player
 */
const calculateNewRating = (actual: number, expected: number, rating: number, roundsPlayed: number, useDecayingKFactor?: boolean): number => {
    const scaledRating = Math.round((rating + kFactorScaled(roundsPlayed) * (actual - expected)));
    const normRating = Math.round((rating + kFactorStatic * (actual - expected)));

    return useDecayingKFactor ? scaledRating : normRating;
};

/**
 * Get the expected outcome for a game between 2 players.
 * @param rating1 Player 1 rating
 * @param rating2 Player 2 rating
 * @returns a tuple of the expected player 1 and 2 ratings
 */
const getExpectedPlayerOutcomes = (rating1: number, rating2: number): [number, number] => {
    const expectedP1Rating = calculateExpectedOutcome(rating1, rating2);

    return [expectedP1Rating, 1 - expectedP1Rating];
};

/**
 * Given two players, their ratings, and their score (1 = win, 0 = loss), return their new ratings.
 * @param rating1
 * @param score1
 * @param rating2
 * @param score2
 * @param roundsPlayed1
 * @param roundsPlayed2
 * @param useDecayingKFactor
 * @returns
 */
export const getNewPlayerRatings = (rating1: number, score1: number, rating2: number, score2: number, roundsPlayed1: number, roundsPlayed2: number, useDecayingKFactor = true): [number, number] => {
    const [expectedP1Rating, expectedP2Rating] = getExpectedPlayerOutcomes(rating1, rating2);

    const newP1Rating = calculateNewRating(score1, expectedP1Rating, rating1, roundsPlayed1, useDecayingKFactor);
    const newP2Rating = calculateNewRating(score2, expectedP2Rating, rating2, roundsPlayed2, useDecayingKFactor);

    return [newP1Rating, newP2Rating];
};
