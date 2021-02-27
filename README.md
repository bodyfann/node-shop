# node-shop

Node.JS shop based on Udemy class "NodeJS - The Complete Guide (MVC, REST APIs, GraphQL, Deno)".

- Master branch follows the class's instructions (added PayPal and Google Storage).
- Google_Datastore branch uses Google Cloud Platform Datastore (with gstore-node ORM).
- App is running in Google App Engine here: http://node-test-store.wl.r.appspot.com/.

## DISCLAIMER

This was my first attempt at building a node app deviating from the teacher's implementation. In some parts, particularly when using Promises, the code may be sub-optimal (I am still learning the basic concepts).

## TODO

- Enhance models to use References and "populate" (need to get a better understanding).
- Explore using PubSub to handle webhooks (Not really needed, but good exercise to learn more about GCP).
- Add Braintree integration.
- Code clean up.
- Improve logging using a library amd removing console.log in the process.
- Setup monitoring

## ISSUES

- [MINOR] Based on the logs, it seems that the Order page is called twice after completing an order...why?
- [MAJOR] PayPal Webhooks seem to have issues and at times I seem getting a 404...why? From local only?
