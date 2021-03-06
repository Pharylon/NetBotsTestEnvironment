﻿//rootAddress = "http://localhost:53299/api/";
rootAddress = "http://aibattleground.com/api/";
version = 3.4;

var delay = 250;

$(function () {
    $('html').keydown(function (e) {
        if (e.which == 39) {
            delay -= 100;
        }
        else if (e.which == 37) {
            delay += 100;
        }
        else if (e.which == 38) {
            delay = 0;
        }
    });
});

$(function () { $("[data-toggle='tooltip']").tooltip(); });

$(document).ready(function () {
    $("#enemy-address").hide();
    getDropDowns();
    getSavedOptions();
    checkForUpdate();

    $('#fight-local').click(function () {
        if ($('#fight-local').is(':checked')) {
            $('#enemy-address').show();
            $('#enemy-selection').hide();
        } else {
            $('#enemy-address').hide();
            $('#enemy-selection').show();
        }
    });
});

function checkForUpdate() {
    var jsonLoc = "http://pharylon.github.io/netbots-debug/version.json";
    $.ajax({
        url: "relay.json",
        type: "POST",
        data: JSON.stringify({ payload: null, destination: jsonLoc }),
        dataType: "json",
        success: function (versionInfo) {
            if (versionInfo.version > version) {
                $("#version-alert").show();
            }
        },
    });
}

function getSavedOptions() {
    var address = $.cookie('client-address');
    $("#client-address").val(address);
    var cors = $.cookie('cors');
    $("#cors-on").prop('checked', cors == "true");
    var enemyAddress = $.cookie('enemy-address');
    if (typeof enemyAddress != 'undefined') {
        $('#enemy-address').val(enemyAddress);
    }
}

function getDropDowns() {
    $.ajax({
        url: rootAddress + "botlist",
        crossDomain: true,
        dataType: "json",
        success: function (response) {
            $.each(response, function (i, bot) {
                $("#enemy-selection").append($("<option></option>").attr("value", bot.id).text(bot.name));
            });
        },
        error: function (error) {
            writeError(error, "Error getting dropdowns from remote game server.");
        }
    });
}

function getPlayerId(pName) {
    var selector = "#" + pName + "-select";
    if ($('#fight-local').is(':checked')) {
        return -1;
    }
    if ($(selector).is(':checked')) {
        return -1;
    } else {
        return $('#enemy-selection').val();
    }
}

function setCookies() {
    var clientAddress = $("#client-address").val();
    $.cookie('client-address', clientAddress);
    var enemyAddress = $("#enemy-address").val();
    if (enemyAddress.length > 0) {
        $.cookie('enemy-address', clientAddress);
    }
    var corsChecked = $("#cors-on").is(':checked');
    $.cookie('cors', corsChecked);
}

$("#new-game").on('click', function () {
    setCookies();
    var seed = getSetSeed();
    var side = getSide();
    var p1Id = getPlayerId("p1");
    var p2Id = getPlayerId("p2");
    if (side == "P1") {
        $('#red-name').text($('#client-address').val());
        if ($('#enemy-selection').is(':visible')) {
            $('#blue-name').text($('#enemy-selection option:selected').text());
        } else {
            $('#blue-name').text($('#enemy-address').val());
        }
    }
    if (side == "P2") {
        $('#blue-name').text($('#client-address').val());
        if ($('#enemy-selection').is(':visible')) {
            $('#red-name').text($('#enemy-selection option:selected').text());
        } else {
            $('#red-name').text($('#enemy-address').val());
        }
    }
    $.ajax({
        url: rootAddress + "startgame",
        type: "POST",
        data: JSON.stringify({ p1Id: p1Id, p2Id: p2Id, seed: seed }),
        dataType: "json",
        contentType: "application/json; charset=utf-8",
        success: function (gameState) {
            showTurn(gameState);
            runGame(gameState);
        },
        error: function (error) {
            writeError(error, "Error starting game with remote game server");
        }
    });
});

function getSetSeed() {
    var seed = $("#seed").val();
    if (seed.length < 1) {
        seed = Math.ceil(Math.random() * 100000000);
        $("#seed-output").text("Your game's seed value is " + seed + "\r\n" +
            "Enter this value above to replay energy spawn positions in a future game" +
            "Note: Enemy bots may use their own hidden randomizers in their algorithms, " +
            "so it may not be possible to replay the game exactly");
    }
    return seed;
}

function updateGame(gameState, p1Moves, p2Moves) {
    return $.ajax({
                url: rootAddress + "updategame",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify({ gameState: gameState, p1Moves: p1Moves, p2Moves: p2Moves })
            });
}


function getMovesRelay(moveRequest, address) {
    return $.ajax({
        url: "relay.json",
        type: "POST",
        data: JSON.stringify({ payload: moveRequest, destination: address }),
        dataType: "json",
        contentType: "application/json; charset=utf-8",
    });
}

function getMovesCors(moveRequest, address) {
    return $.ajax({
        url: address,
        type: "POST",
        data: JSON.stringify(moveRequest),
        dataType: "json",
        contentType: "application/json; charset=utf-8",
    });
}

function getMoves(gameState, playerName, address) {
    var moveRequest = new Object();
    moveRequest.player = playerName;
    moveRequest.state = gameState;
    if ($('#cors-on').is(':checked')) {
        return getMovesCors(moveRequest, address);
    } else {
        return getMovesRelay(moveRequest, address);
    }
}

function writeError(error, errorText) {
    if (typeof error.responeText != 'undefined') {
        errorText += "  " + error.responeText;
    }
    alert("Error: " + errorText);
}

function runGame(gameState) {
    var startTime = new Date();
    var clientIsP1 = $('#p1-select').is(':checked');
    var clientMoves = getPlayerMoves(gameState);
    clientMoves.done(function (cMoves) {
        if (cMoves == null) {
            cMoves = [];
        }
        getEnemyMoves(gameState).done(function (eMoves) {
            if (eMoves == null) {
                eMoves = [];
            }
            var p1Moves = clientIsP1 ? cMoves : eMoves;
            var p2Moves = clientIsP1 ? eMoves : cMoves;
            var uGameReq = updateGame(gameState, p1Moves, p2Moves);
            uGameReq.done(function(newGameState) {
                if (newGameState.turnsElapsed < newGameState.maxTurns) {
                    showTurn(newGameState);
                    if (newGameState.winner == null) {
                        var endTime = new Date();
                        var executionTime = endTime.getTime() - startTime.getTime();
                        var timeLeftToWait = delay - executionTime;
                        if (timeLeftToWait < 0) {
                            timeLeftToWait = 0;
                        }
                        setTimeout(function () { runGame(newGameState); }, timeLeftToWait);
                    }
                }
            });
            uGameReq.fail(function (jqXhr, textStatus, errorThrown) {
                writeError(jqXhr, "Error contacting the remote game server.");
            });
        });
    });
    clientMoves.fail(function (jqXhr, textStatus, errorThrown) {
        writeError(jqXhr, "There was an error communicating with your bot!");
    });
}



function getPlayerMoves(gameState) {
    var address = $('#client-address').val();
    if ($('#p1-select').is(':checked')) {
        return getMoves(gameState, "p1", address);
    } else {
        return getMoves(gameState, "p2", address);
    }
}

function getEnemyMoves(gameState) {
    if ($('#fight-local').is(':checked')) {
        var address = $('#enemy-address').val();
        if ($('#p1-select').is(':checked')) {
            return getMoves(gameState, "p2", address);
        } else {
            return getMoves(gameState, "p1", address);
        }
    } else {
        var emptyPromise = new $.Deferred();
        emptyPromise.resolve(null);
        return emptyPromise;
    }
    
}


function getSide() {
    if ($('#p2-select').is(':checked')) {
        return "P2";
    } else {
        return "P1";
    }
}