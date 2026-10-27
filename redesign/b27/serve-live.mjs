// Local review origin for the unchanged native shell (which opens origin '/').
// All authentication/data requests still go to the isolated QA app on 8771.
import {createReviewServer} from './review-server.mjs';
const port=Number(process.env.SATORU_REVIEW_PORT||8773);
createReviewServer({welcome:process.env.SATORU_REVIEW_WELCOME==='1'}).listen(port,'127.0.0.1',()=>console.log('B2.13 review: http://localhost:'+port));
