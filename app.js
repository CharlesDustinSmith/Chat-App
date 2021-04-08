const path = require( "path" );

const express =  require( "express" );
const app = express();

const formidable = require( "express-formidable" );
app.use( formidable() );

const mongodb = require( "mongodb" );
const mongoClient = mongodb.MongoClient;
const ObjectID = mongodb.ObjectId;

const http = require( "http" ).createServer(app);
const bcrypt = require( "bcrypt" );
const fileSystem = require( "fs" );

const jwt = require( "jsonwebtoken" );
const { request } = require("http");
const { json } = require("express");
const accessTokenSecret = "myAccessTokenSecret1234567890";

app.use(express.static(path.join(__dirname, "public")));
app.use('/public/images/', express.static('./public/images'));
app.use('/public/videos/', express.static('./public/videos'));
app.use('/public/css/', express.static('./public/css'));
app.use('/public/js/', express.static('./public/js'));
app.set("view engine", "ejs");

const socketIO = require( "socket.io" )(http);
const socketID = "";
const users = [];

const mainURL = "http://localhost:3000";

socketIO.on( "connection", function(socket) {
    console.log( "User connected", socket.id );
    socketID = socket.id;
} );

http.listen( 3000, function () {
    console.log( "Sever started." );

    mongoClient.connect( "mongodb://localhost:27017", function( error, client )  {
        const database = client.db( "chat_app" );
        console.log( "Database connected." );

        app.get( "/signup", function(req, res) {
            res.render( "signup" );
        } );

        app.get( "/login", function( req, res ) {
            res.render( "login" );
        } );

        app.get( "/updateProfile", function( req, res ) {
            res.render( "updateProfile" );
        } );

        app.get("/logout", function( req, res ) {
            res.redirect( "/login" ); 
        } );

        app.get("/", function(req, res) {
            res.render("index");
        } );

        // app.get( "/homepage", function(req, res) {
        //     res.render("homepage", {
        //         "query": ''
        //     });
        // } )

        app.get( "/search/:query", function(req, res) {
            var query = req.params.query;
                res.render("search", {
                    "query": query
                });
        } );

        app.get("/friends", function(req, res) {
            res.render("friends");
        } );

        app.get("/inbox", function(req, res) {
            res.render("inbox");
        });

        // app.get("/", function(req, res) {
        //     res.redirect("/login");
        // });

        // app.get("/friends", function(req, res) {
        //     res.render("friends");
        // });

        app.post( "/signup", function( req, res ) {
            var name = req.fields.name;
            var username = req.fields.username;
            var email = req.fields.email;
            var password = req.fields.password;
            var gender = req.fields.gender;

            database.collection( "users" ).findOne( {
                $or: [{
                    "email" : email
                }, {
                    "userName" : username
                }]
            }, function( err, user ) {
                if( user == null ) {
                    bcrypt.hash( password, 10, function( err, hash ) {
                        database.collection( "users" ).insertOne( {
                            "name": name,
                            "username": username,
                            "email": email,
                            "password": hash,
                            "gender": gender,
                            "profileImage": "",
                            "coverPhoto": "",
                            "dob": "",
                            "city": "",
                            "country": "",
                            "aboutMe": "",
                            "friends": [],
                            "pages": [],
                            "notifications": [],
                            "groups": [],
                            "posts": []
                        }, function( err, data ) {
                            res.json( {
                                "status": "success", 
                                "message": "Signed up successfully. You can login now."
                            } );
                        } );
                    } );
                } else {
                    res.json( {
                        "status": "error",
                        "message": "Email or username already in use."
                    } );
                }
            } );
        } );

        app.post( "/login", function( req, res ) {
            var email = req.fields.email;
            var password = req.fields.password;

            database.collection( "users" ).findOne({
                "email": email
            }, function(err, user) {
                if( user == null) {
                    res.json( {
                        "status": "error",
                        "message": "Email does not exist"
                    } );
                } else {
                    bcrypt.compare( password, user.password, function( err, isCorrect ) {
                        if( isCorrect ) {
                            var accessToken = jwt.sign( {email: email }, accessTokenSecret);
                            database.collection( "users" ).findOneAndUpdate( {
                                "email": email
                            }, {
                                $set: {
                                    "accessToken": accessToken
                                }
                            }, function( err, data ) {
                                res.json( {
                                    "status": "success",
                                    "message": "Login successfuly.", 
                                    "accessToken": accessToken,
                                    "profileImage": user.profileImage
                                } );
                            } );
                        } else {
                            res.json( {
                                "status": "error",
                                "message": "Password is not correct"
                            } );
                        }
                    } );
                }
            } );
        } );

        app.post( "/uploadCoverPhoto", function(req, res) {
            var accessToken = req.fields.accessToken;
            var coverPhoto = "";

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    if(req.files.coverPhoto.size > 0 && req.files.coverPhoto.type.includes("image")) {
                        if( user.coverPhoto != "" ) {
                            fileSystem.unlink(user.coverPhoto, function(err) {
                                if(err) {
                                    console.log(err);
                                }
                            });
                        }
                        coverPhoto = "public/images/" +  new Date().getTime() + "-" + req.files.coverPhoto.name;
                        fileSystem.rename(req.files.coverPhoto.path, coverPhoto, function(err) {
                            if(err) {
                                console.log(err);
                            }
                        });

                        database.collection("users").updateOne({
                            "accessToken": accessToken
                        }, {
                            $set: {
                                "coverPhoto": coverPhoto
                            }
                        }, function(err, data) {
                            res.json( {
                                "status": "status",
                                "message": "Cover photo has been updated.",
                                data : mainURL + "/" + coverPhoto
                            } );
                        } );
                    } else {
                        res.json( {
                            "status": "eror", 
                            "message": "Please select valid image."
                        } );
                    }
                }
            } );
        } );

        app.post( "/uploadProfileImage", function(req, res) {
            var accessToken = req.fields.accessToken;
            var coverPhoto = "";

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again"
                    });
                } else {
                    if(req.files.profileImage.size > 0 && req.files.profileImage.type.includes("image")) {
                        if( user.profileImage != "" ) {
                            fileSystem.unlink(user.profileImage, function(err) {
                                console.log(err);
                            });
                        }
                        profileImage = "public/images/" +  new Date().getTime() + "-" + req.files.profileImage.name;
                        fileSystem.rename(req.files.profileImage.path, profileImage, function(err) {
                            console.log(err);
                        });

                        database.collection("users").updateOne({
                            "accessToken": accessToken
                        }, {
                            $set: {
                                "profileImage": profileImage
                            }
                        }, function(err, data) {
                            res.json({
                                "status": "status",
                                "message": "Cover photo has been updated.",
                                data : mainURL + "/" + profileImage
                            });
                        });
                    } else {
                        res.json({
                            "status": "eror", 
                            "message": "Please select valid image."
                        });
                    }
                }
            });
        } );

        app.post( "/getUser",  function( req,  res ) {
            var accessToken = req.fields.accessToken;
            database.collection( "users" ).findOne( {
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json( {
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    } );
                } else {
                    res.json( {
                        "status": "success",
                        "message": "Record has been fetched.",
                        "data": user
                    } );
                }
            } );
        } );

        app.post("/updateProfile", function(req, res) {
            var accessToken = req.fields.accessToken;
            var name = req.fields.name;
            var dob = req.fields.dob;
            var city = req.fields.city;
            var country = req.fields.country;
            var aboutMe = req.fields.aboutMe;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null){
                    res.json({
                        "status": "error", 
                        "message": "User has been logged out. Please login again"
                    });
                } else {
                    database.collection("users").updateOne({
                        "accessToken": accessToken
                    }, {
                        $set: {
                            "name": name,
                            "dob": dob,
                            "city": city,
                            "country": country,
                            "aboutMe": aboutMe
                        }
                    }, function(err, data) {
                        res.json({
                            "status":"status",
                            "message": "Profile has been updated."
                        });
                    });
                }
            });
        });

        app.post("/addPost", function(req, res) {
            var accessToken = req.fields.accessToken;
            var caption = req.fields.caption;
            var image = "";
            var video = "";
            var type = req.fields.type;
            var createdAt = new Date().getTime();
            var _id = req.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    if(req.files.image.size > 0 && req.files.image.type.includes("image")) {
                        image = "public/images/" + new Date().getTime() + "-" + req.files.image.name;
                        fileSystem.rename(req.files.image.path, image, function(err) {
                            if(err) {
                                console.log(err);
                            }
                        } );
                    }
                    if(req.files.video.size > 0 && req.files.video.type.includes("video")) {
                        video = "public/videos/" + new Date().getTime() + "-" + req.files.video.name;
                        fileSystem.rename(req.files.video.path, video, function(err) {
                            if(err) {
                                console.log(err);
                            }
                        });
                    }

                    database.collection("posts").insertOne({
                        "caption": caption,
                        "image": image,
                        "video": video,
                        "type": type,
                        "createdAt": createdAt,
                        "likers": [],
                        "comments": [],
                        "shares": [],
                        "user": {
                            "_id": user._id,
                            "name": user.name,
                            "profileImage": user.profileImage
                        }
                    }, function(err, data) {
                        database.collection("users").updateOne({
                            "accessToken": accessToken
                        }, {
                            $push: {
                                "posts": {
                                    "_id": data.insertedId,
                                    "caption": caption,
                                    "image": image,
                                    "video": video,
                                    "type": type,
                                    "createdAt": createdAt,
                                    "likers": [],
                                    "comments": [],
                                    "shares": []
                                }
                            }
                        }, function(err, data) {
                            res.json({
                                "status": "success",
                                "message": "post has been uploaded."
                            } );
                        } );
                    } );
                }
            } );
        } );

        app.post("/getNewsfeed", function(req, res) {
            var accessToken = req.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var ids = [];
                    ids.push(user._id);

                    database.collection("posts").find({
                        "user._id": {
                            $in: ids
                        }
                    }).sort({
                        "createAt": -1
                    })
                    .limit(5)
                    .toArray(function(err, data) {
                        res.json({
                            "status": "success",
                            "message": "Record has been fetched",
                            "data": data
                        });
                    });
                }
            });
        } );

        app.post("/search", function(req, res) {
            var query = req.fields.query;

            database.collection("users").find({
                "name": {
                    $regex: ".*" + query + ".*",
                    $options: "i"
                }
            }).toArray(function(err, data) {
                res.json({
                    "status": "success",
                    "message": "Record has been fetched",
                    "data": data
                });
            });
        } );

        app.post("/sendFriendRequest", function(req, res) {
            var accessToken = req.fields.accessToken;
            var _id = req.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id":ObjectID(_id)
                    }, function(err, user) {
                        if(user == null) {
                            res.json({
                                "status": "error", 
                                "message": "User does not exist."
                            });
                        } else {

                            database.collection("users").updateOne({
                                "_id":ObjectID(_id)
                            }, {
                                $push: {
                                    "friends": {
                                        "_id": me._id,
                                        "name": me.name,
                                        "profileImage": me.profileImage,
                                        "status": "Pending", 
                                        "sentByMe": false,
                                        "inbox": []
                                    }
                                }
                            }, function(err, data) {

                                database.collection("users").updateOne({
                                    "_id": me._id
                                }, {
                                    $push: {
                                        "friends": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage,
                                            "status": "Pending",
                                            "sentByMe": true,
                                            "inbox": []
                                        }
                                    }
                                }, function(err, data) {
                                    res.json({
                                        "status": "success",
                                        "message": "Friend request has been sent."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        } );

        app.post("/acceptFriendRequest", function(req, res) {
            var accessToken = req.fields.accessToken;
            var _id = req.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectID(_id)
                    }, function(err, user) {
                        if(user == null) {
                            res.json({
                                "status": "error",
                                "message": "User does not exist."
                            });
                        } else {
                            database.collection("users").updateOne({
                                "_id": ObjectID(_id),
                            }, {
                                $push: {
                                    "notifications": {
                                        "_id": ObjectID(),
                                        "type": "friend_request_accepted",
                                        "content": me.name + " accepted your friend request.",
                                        "profileImage": me.profileImage,
                                        "createdAt": new Date().getTime()
                                    }
                                }
                            });
                            database.collection("users").updateOne({
                                $and: [{
                                    "_id": ObjectID(_id)
                                }, {
                                    "friends._id": me._id
                                }]
                            }, {
                                $set: {
                                    "friends.$.status": "Accepted"
                                }
                            }, function(err, data) {
                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": me._id
                                    }, {
                                        "friends._id": user._id
                                    }]
                                }, {
                                    $set: {
                                        "friends.$.status": "Accepted"
                                    }
                                }, function(err, data) {
                                    res.json({
                                        "status": "success",
                                        "message": "Friend request has been accepted."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        app.post("/unfriend", function(req, res) {
            var accessToken = req.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectID(_id)
                    }, function(err, user) {
                        if(user == null) {
                            res.json({
                                "status": "error",
                                "message": "User does not exist."
                            });
                        } else {
                            database.collection("users").updateOne({
                                "_id": ObjectID(_id)
                            }, {
                                $pull: {
                                    "friends": {
                                        "_id": me._id
                                    }
                                }
                            }, function(err, data) {
                                database.collection("users").updateOne({
                                    "_id": me._id
                                }, {
                                    $pull: {
                                        "friends": {
                                            "_id": user._id
                                        }
                                    }
                                }, function(err, data) {
                                    res.json({
                                        "status": "success",
                                        "message": "Friend has been removed."
                                    })
                                });
                            });
                        }
                    });
                }
            });
        });
        
        app.post("/getFriendsChat", function(req, res) {
            var accessToken = req.fields.accessToken;
            var _id = req.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var index = user.friends.findIndex(function(friend) {
                        return friend._id == _id;
                    });
                    var inbox = user.friends[index].inbox;

                    res.json({
                        "status": "success",
                        "message": "Record has been fetched",
                        "data": inbox
                    });
                }
            });
        });

        app.post("/sendMessage", function(req, res) {
            var accessToken = req.fields.accessToken;
            var _id = req.fields._id;
            var message = req.fields.message;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error", 
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectID(_id)
                    }, function(err, user) {
                        if(user == null) {
                            res.json({
                                "status": "error",
                                "message": "User does not exist."
                            });
                        } else {
                            database.collection("users").updateOne({
                                $and: [{
                                    "_id": ObjectID(_id)
                                }, {
                                    "friends._id": me._id
                                }]
                            }, {
                                $push: {
                                    "friends.$.inbox": {
                                        "_id": ObjectID(),
                                        "message": message,
                                        "from": me._id
                                    }
                                }
                            }, function(err, data) {
                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": me._id
                                    }, {
                                        "friends>_id": user._id
                                    } ]
                                }, {
                                    $push: {
                                        "friends.$.inbox": {
                                            "_id": ObjectID(),
                                            "message": message,
                                            "from": me._id
                                        }
                                    }
                                }, function(err, data) {
                                    
                                    socketIO.to(users[user._id]).emit("messageRecieved", {
                                        "message": message,
                                        "from": me._id
                                    });

                                    res.json({
                                        "status": "success",
                                        "message": "Message has been sent."     
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        app.post("/connectSocket", function(req, res) {
            var accessToken = req.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(err, user) {
                if(user == null) {
                    res.json({
                        "status": "error", 
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    users[user._id] = socketID;
                    res.json({
                        "status": "status",
                        "message": "Socket has been connected."
                    });
                }
            });
        });

        // app.post( "/homepage", function(req, res) {
        //     var query = req.fields.query;
        //     database.collection("users").find({
        //         "firstName": {
        //             $regex : "^" + query + "$",
        //             $options : "i"
        //         }
        //     }).toArray(function(err, data) {
        //         res.json({
        //             "status": "success",
        //             "message": "Record has been fetched",
        //             "data": data
        //         });
        //     });
        // } );

        // app.post("/sendFriendRequest", function(req, res) {
        //     var accessToken = req.fields.accessToken;
        //     var _id = req.fields._id;

        //     database.collection("users").findOne({
        //         "accessToken": accessToken
        //     }, function(err, user) {
        //         if(user == null) {
        //             res.json({
        //                 "status": "error",
        //                 "message": "User has been logged out. Please login again."
        //             });
        //         } else {
        //             var me = user;
        //             database.collection("users").findOne({
        //                 "_id": ObjectID(_id)
        //             }, {
        //                 $push: {
        //                     "friends" : {
        //                         "_id": me._id,
        //                         "firstName": me.firstName,
        //                         "lastName": me.lastName,
        //                         "profileImage": me.profileImage, 
        //                         "status": "Pending",
        //                         "sendByMe": false,
        //                         "inbox": []
        //                     }
        //                 }
        //             }, function(err, data) {
        //                 database.collection("users").updateOne({
        //                     "_id": me._id
        //                 }, {
        //                     $push: {
        //                         "friends":  {
        //                             "_id": user._id,
        //                             "firstName": user.firstName,
        //                             "lastName": user.lastName,
        //                             "profileImage": user.profileImage, 
        //                             "status": "Pending",
        //                             "sendByMe": true,
        //                             "inbox": []
        //                         }
        //                     }
        //                 }, function(err, data) {
        //                     res.json({
        //                         "status": "success", 
        //                         "message": "Friend request has been sent."
        //                     });
        //                 });
        //             });
        //         }
        //     });
        // });

        
    } );
} ); 