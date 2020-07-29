## Virtual Party

This is a project to create a "virtual" party through the browser. Complete with distance-based audio (just like in real life!) and music playing that can be controlled by everyone.

## Local Development

To test audio locally without feedback squeals, it can be useful to have one machine just sending music to your other machine. For this I used a virtual cable on one machine that routed music playing to another machine:

https://www.vb-audio.com/Cable/index.htm

To run the project locally you'll need to install the dependencies and spin up the server

```
npm install
npm run development
```

Since you'll be doing multiple machines across the network, they can't all be localhost so we opted for a cert for `party.live` that is packaged in this repo.
On each of the machines you'll need to add a hosts file entry pointing to the machine running the server.

```
party.local 192.168.x.x
```

Then you'll need to add the certificate to the root trust store on each machine.

The certificate is needed because Chrome won't allow certain resources (microphone, camera, etc) without the page being served securely.
