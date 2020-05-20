require('dotenv').config()
const rp = require('request-promise')
const NodeCache = require( "node-cache" );
const myCache = new NodeCache({stdTTL: 4200, checkperiod: 120});
/**
 * Cache objects being used-
 * trendingVideoCounter - maintains the count of when to poll youtube for trending videos again
 * postedVideos - Maintains a set of posted videos from last 4 days. 
 *                1. Works on First In Last Out Stack of 96 elements (24 * 4). 
 *                2. List gets updated hourly.(FILO)
 *                
 * trendingVideos - Maintains a set of 50 or less fresh trendingVideos
 *                  1. The whole list gets generated after completing 24 hr. from the start
 *                  2. In pre-processing stage, the new videos are matched with alreadyPosted videos are removed
 *                  3. This list gets updated hourly,(FIFO)
 *                   
 */
setInterval(async function(){
    await main()
},60 * 60 * 1000)

async function main(){
    try{
        let alreadyPosted = []
        let postedVideos = []
        if (!myCache.get('trendingVideoCounter') || myCache.get('trendingVideoCounter') === 24){
            myCache.set('trendingVideoCounter', 1)
            const trendingVideos = await getTrendingFor24Hours()
            const trendingVideosList = new Set(trendingVideos)
            if (myCache.get('postedVideos')){
                alreadyPosted = myCache.get('postedVideos')
                postedVideos = new Set(alreadyPosted.list)
            }else{
                postedVideos = new Set([])
            }
            freshTrendingVideos = [...difference(trendingVideosList, postedVideos)]
            console.log('freshTrendingVideos',freshTrendingVideos)
            myCache.set('trendingVideos', {list: freshTrendingVideos})
            try{
                const postId = await postOnFacebook(trendingVideos)
                console.log('Posted on facebook',postId)
            }catch(e){
                console.error('Error in posting data',e)
            }
        }else{
            myCache.set('trendingVideoCounter', parseInt(myCache.get('trendingVideoCounter')) + 1)
            try{
                const trendingVideos = myCache.get('trendingVideos')
                const postId = await postOnFacebook(trendingVideos.list)
                console.log('Posted on facebook',postId)
            }catch(e){
                console.error('Error in posting data',e)
            }
        }
    }catch(e){
        console.error('Error in a process',e)   
    }
}

async function getTrendingFor24Hours(){
    let trendingVideos = []
    try{
        const response = await rp(
            {   
                method: 'GET',
                uri: `https://www.googleapis.com/youtube/v3/videos`, 
                qs: {
                    key: process.env.youtubeAccessToken,
                    chart : 'mostPopular',
                    part:'snippet,statistics',
                    regionCode : process.env.regionCode,
                    maxResults:50
                },
                json: true
            }
        )
        trendingVideos = response.items.map(el=>{
            return {
                id : el.id,
                publishedAt:el.snippet.publishedAt,
                title:el.snippet.title,
                channelTitle:el.snippet.channelTitle,
                viewCount:el.statistics.viewCount
            }
        })
        return trendingVideos
    }catch(e){
        console.error('Error in getting data from youtube',e)
    }
}

async function postOnFacebook(videos){
    const currentVideoToPost = videos[0]
    videos.shift()
    myCache.set('trendingVideos', {'list' : videos})
    const data = {
        message : `Published On : ${currentVideoToPost.publishedAt} \n
                Channel Title : ${currentVideoToPost.channelTitle} \n
                View Count : ${currentVideoToPost.viewCount}`,
        link :`https://www.youtube.com/watch?v=${currentVideoToPost.id}`
    }
    postId = await rp(
        {   
            method: 'POST',
            uri: `https://graph.facebook.com/v7.0/${process.env.pageId}/feed`, 
            qs: {
                access_token: process.env.fbAccessToken,
                ...data 
            },
            json: true
        }
    )
    //create a stack of 96 elements and pop and unshift when the list reaches 100
    let alreadyPosted = []
    if(myCache.get('postedVideos')){
        const postedVideos = myCache.get('postedVideos')
        alreadyPosted = postedVideos.list
        console.log('alreadyPosted before',alreadyPosted)
    } 
    if(alreadyPosted.length <= 96){
        alreadyPosted.unshift(currentVideoToPost.id)
    }else{
        alreadyPosted.pop
        alreadyPosted.unshift(currentVideoToPost.id)
    }
    console.log('alreadyPosted after',alreadyPosted)
    myCache.set('postedVideos',{'list':alreadyPosted})
    return postId
}

function difference(setA, setB) {
    let _difference = new Set(setA)
    for (let elem of setB) {
        _difference.delete(elem)
    }
    return _difference
}
