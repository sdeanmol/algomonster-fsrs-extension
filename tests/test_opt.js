const { computeParameters, FSRSBindingItem, FSRSBindingReview } = require('@open-spaced-repetition/binding');

async function test() {
    const reviews = [
        new FSRSBindingReview(3, 1),
        new FSRSBindingReview(3, 3),
        new FSRSBindingReview(4, 8)
    ];
    const trainSet = [];
    for(let i=0; i<80; i++) {
        trainSet.push(new FSRSBindingItem(reviews));
    }
    
    console.log("Run 1...");
    let w1 = await computeParameters(trainSet, { enableShortTerm: false, timeout: 10000 });
    console.log("Run 1 success!");
}
test().catch(console.error);
