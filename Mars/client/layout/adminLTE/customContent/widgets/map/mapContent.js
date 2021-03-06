import { Random } from 'meteor/random';
import { Session } from 'meteor/session'

Template.mapContent.onCreated(function() {
    var self = this;

// ================================================
// Function to run once googlemaps api is ready
    GoogleMaps.ready('map', function(map) {
    // ================================================
    // Setup common variables
        // Define map symbols for tags and nodes
        var icons = {
            tag: {
              name: 'Tag',
              default: new Icon('Tag','LimeGreen'),
              selected: new Icon('Tag','Aqua'),
              alert: new Icon('Tag','OrangeRed')
            },
            node: {
              name: 'Node',
              default: new Icon('Node','LimeGreen'),
              selected: new Icon('Node','Aqua'),
              alert: new Icon('Node','OrangeRed')
            }
        };

        // Create Google Maps data layers for tags and nodes
        nodeLayer = new google.maps.Data({
          map: map.instance,
          style: {
            clickable: true,
            icon: icons.node.default
          }
        });

        tagLayer = new google.maps.Data({
          map:map.instance,
          style: {
            clickable: true,
            icon: icons.tag.default
          }
        });

        var textbox = ''
    // ================================================
    // Draw map controls
        // Draw Legend
        drawlegend();
        // Draw Interrogation Controls
        interrogateControls();
        // Draw infobox
    // ================================================
    // Reactively update map
        self.autorun(function() {

          const nodes = SortedNodes.find().observe({

            added: function(document) {
              addNode(document);

              var status = Status.find({}).fetch()[0]
              if (typeof status !== 'undefined'){
                var command = status.command;
                if (command == 0){
                  nodeLayer.forEach(function(pin){
                    nodeLayer.overrideStyle(pin, {icon: icons.node.selected});
                  });

                } else if (command == 100){
                  nodeLayer.forEach(function(pin){
                    nodeLayer.revertStyle();
                  });

                } else {
                  var pin = nodeLayer.getFeatureById(command)
                  nodeLayer.overrideStyle(pin, {icon: icons.node.selected});
                }
              }
            },

            changed: function(newDocument, oldDocument) {
              var gps = newDocument.pos[0];

              var latLng = new google.maps.LatLng({lat: gps.lat, lng: gps.lon});

              var pin = nodeLayer.getFeatureById(oldDocument._id);
              pin.setGeometry(latLng);
              pin.setProperty('timestamp', gps.timestamp);
              nodeLayer.revertStyle(pin);
              //removeMapObject(txtbox);
            },

            removed: function(oldDocument) {
              var pin = nodeLayer.getFeatureById(oldDocument._id);
              if (typeof pin !== 'undefined'){
                // Node is already plotted on map
                // Remove exsisting marker
                nodeLayer.remove(pin);
                if (typeof txtbox !== 'undefined'){
                  removeMapObject(txtbox);
                }
                console.log('Removed map marker for node: ' + oldDocument._id);
              }
            }
          });

          const tags = SortedTags.find().observe({

            added: function(document) {
              //console.log(document)
              addTag(document);
            },

            changed: function(newDocument, oldDocument) {
              //console.log(newDocument)
              var pos = newDocument.pos;

              if (typeof pos !== 'undefined'){

                var latLng = new google.maps.LatLng({lat: pos.lat, lng: pos.lon});
                //console.log({lat: latLng.lat(), lon: latLng.lng()})
                var pin = tagLayer.getFeatureById(newDocument._id);
                pin.setGeometry(latLng);
                pin.setProperty('timestamp', pos.timestamp);
              }
              //removeMapObject(txtbox);
            },

            removed: function(oldDocument) {

              var pin = tagLayer.getFeatureById(oldDocument._id);
              if (typeof pin !== 'undefined'){
                // Node is already plotted on map
                // Remove exsisting marker
                tagLayer.remove(pin);
                if (typeof txtbox !== 'undefined'){
                  removeMapObject(txtbox);
                }

                console.log('Removed map marker for tag: ' + oldDocument._id);
              }
            }});

        });
    //===================================================
    // Google Maps listeners for displaying infoboxes
        // Nodes: Mouseover event
        nodeLayer.addListener('mouseover',
            function (event) {
              // console.log('mouseover: ' + event.feature.getId());
              var node = event.feature;
              var id = node.getId();
              var latLng = node.getGeometry().get();
              var timestamp = node.getProperty('timestamp');
              var elapsedtime = time_diff(timestamp);

              var txt = "<b>Node ID: </b>" + "<br> " + id + "<br><br>" +
                        "<b>Lat: </b>" + "<br> " + latLng.lat() + "<br><br>" +
                        "<b>Lon: </b>" + "<br> " + latLng.lng() + "<br><br>" +
                        "<b>Last Update: </b>" + "<br> " + elapsedtime + " ago <br>";
              var hovertxt = "<b>Node ID: </b>" + id;

              txtbox = hoverBox(event.latLng,txt);
              //$('#infoBox')[0].innerHTML = txt;
              txtbox.show();
            });
        // Nodes: Mouseout event
        nodeLayer.addListener('mouseout',
            function (event) {
              // console.log('mouseout: ' + event.feature.getId());
              removeMapObject(txtbox);
              //$('#infoBox')[0].innerHTML = '';
            });
        // Nodes: Click event
        nodeLayer.addListener('click',
          function (event) {
            var node = event.feature;
            interrogate(event.feature.getId());
          });
        // Tags: Mouseover event
        tagLayer.addListener('mouseover',
            function (event) {
              // console.log('mouseover: ' + event.feature.getId());
              var tag = event.feature;
              var id = tag.getId();
              var latLng = tag.getGeometry().get();
              var timestamp = tag.getProperty('timestamp');
              var elapsedtime = time_diff(timestamp);

              var txt = "<b>Tag ID: </b>" + id + "<br><br>" +
                        "<b>Position: </b>" + "<br> " +
                        "<b>Lat: </b>" + latLng.lat() + "<br> " +
                        "<b>Lon: </b>" + latLng.lng() + "<br> " +
                        "<b>Last Update: </b>" + "<br> " + elapsedtime + " ago <br>";


              txtbox = hoverBox(event.latLng,txt);
              txtbox.show();
            });
        // Tags: Mouseout event
        tagLayer.addListener('mouseout',
            function (event) {
              // console.log('mouseout: ' + event.feature.getId());
              removeMapObject(txtbox);
            });

    //============================
    // Marker Functions
        function addTag(tag) {
          var pos = tag.pos;
          // console.log('\nTag Data:')
          // console.log(tag)
          // console.log('\n')

          // Add tag marker
          var pin = tagLayer.getFeatureById(tag._id);
          var latLng = new google.maps.LatLng({lat: pos.lat, lng: pos.lon});

          if (typeof pin !== 'undefined'){
            // Tag is already plotted on map
            // Update map data
            console.log('Updating map marker for tag: ' + tag._id);
            pin.setGeometry(latLng);
            pin.setProperty('timestamp',pos.timestamp);

          } else {
            // Node is not already plotted on map
            // Plot new node marker
            console.log('Creating new map marker for tag: ' + tag._id);
            var pin_tag = new google.maps.Data.Feature({
              geometry: new google.maps.Data.Point(latLng),
              id: tag._id,
              properties: {
                timestamp: pos.timestamp
              }
            });
          }
          // console.log(pin_tag);
          // console.log(pin_tag.getGeometry().get().lat());
          // console.log(pin_tag.getGeometry().get().lng());
          return tagLayer.add(pin_tag);
        }

        function addNode(node) {
          var gps = node.pos[0];

          // console.log('\nNode Data:')
          // console.log(node)
          // console.log('\n')

          // Add node marker
          var pin = nodeLayer.getFeatureById(node._id);
          var latLng = new google.maps.LatLng({lat: gps.lat, lng: gps.lon});

          if (typeof pin !== 'undefined'){
            // Node is already plotted on map
            // Update map data
            console.log('Updating map marker for node: ' + node._id);
            pin.setGeometry(latLng);
            pin.setProperty('timestamp',gps.timestamp);

          } else {
            // Node is not already plotted on map
            // Plot new node marker
            console.log('Creating new map marker for node: ' + node._id);
            var pin_node = new google.maps.Data.Feature({
              geometry: new google.maps.Data.Point(latLng),
              id: node._id,
              properties: {
                timestamp: gps.timestamp
              }
            });
          }

          // console.log(pin_node);
          // console.log(pin_node.getGeometry().get().lat());
          // console.log(pin_node.getGeometry().get().lng());
          return nodeLayer.add(pin_node);
        }

        function removeMapObject(object) {
            // Function for removing objectss from the map
            if (typeof object !== 'undefined'){
              // Check if object exsists
              object.setMap(null);
            }
        }

    //============================
    // Controls and Overlay Functions
        function hoverBox(latLng, hovertxt){
          var txt = new TxtOverlay(latLng, hovertxt, "hoverBox", map.instance)
          txt.hide();
          return txt;
        }

        function drawlegend(){
          $('<div />',{id: "legendbox",class: 'mapBtnBox'}).appendTo('.map-container');
          $('<div />',{id: "legend", class: "infoBox"}).appendTo('#legendbox');
          //$('#legend').append("<h3>Legend</h3>");
          var legend = $('#legend');
          legend[0].title = "Map Legend";

          for (var key in icons) {
            var type = icons[key];
            var name = type.name;
            var icon = type.default.path;
            var color = type.default.fillColor;
            var label = '<span><svg height="22" width="22" viewBox="0 0 25 25"> <path d=' + icon + ' fill=' + color + '/></svg>' + name + '</span>';
            legend.append(label);
          }
          name = 'Node (Queued for update)';
          icon = icons.node.selected.path;
          color = icons.node.selected.fillColor;

          label = '<span><svg height="22" width="22" viewBox="0 0 25 25"> <path d=' + icon + ' fill=' + color + '/></svg>' + name + '</span>';
          legend.append(label);
          map.instance.controls[google.maps.ControlPosition.TOP_LEFT].push($('#legendbox')[0]);
        }

        function infobox() {
          $('<div />',{id: "infoBox",class: 'mapTxtBox'}).appendTo('.map-container');

          map.instance.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push($('#infoBox')[0])

        }

        function interrogateControls() {
          // Create button container
          $('<div />',{id: "intCtrl",class: 'mapBtnBox'}).appendTo('.map-container');

          // Create interrogation Button
          $('<div />',{id: "intBtn", class: 'mapBtn'}).appendTo('#intCtrl');
          $('<div />',{id: "intBtnTxt",class: "mapBtnTxt"}).appendTo('#intBtn');

          // Create stop button
          $('<div />',{id: "stopBtn",class: 'mapBtn'}).appendTo('#intCtrl');
          $('<div />',{id: "stopBtnTxt",class: "mapBtnTxt"}).appendTo('#stopBtn');

          // Set CSS for the control border.
          var intBtn = $('#intBtn')[0];
          intBtn.title = "Click to interrogate all nodes";

          //Set CSS for the control interior.
          var intBtnTxt = $('#intBtnTxt')[0];
          intBtnTxt.innerHTML = 'Interrogate';

          var stopBtn = $('#stopBtn')[0];
          stopBtn.title = "Click to stop all interrogation";

          //Set CSS for the control interior.
          var stopBtnTxt = $('#stopBtnTxt')[0];
          stopBtnTxt.innerHTML = 'Stop';

          // Setup the click event listeners
          intBtn.addEventListener('click', function() {
            interrogate(); // Send interrogate all command
          });

          stopBtn.addEventListener('click', function() {
            interrogate("100"); // Send stop interrogation command
          });

          map.instance.controls[google.maps.ControlPosition.LEFT_BOTTOM].push($('#intCtrl')[0])
        }

        function TxtOverlay(pos, txt, cls, map) {

              // Now initialize all properties.
              this.pos = pos;
              this.txt_ = txt;
              this.cls_ = cls;
              this.map_ = map;

              // We define a property to hold the image's
              // div. We'll actually create this div
              // upon receipt of the add() method so we'll
              // leave it null for now.
              this.div_ = null;

              // Explicitly call setMap() on this overlay
              this.setMap(map);
        }

        TxtOverlay.prototype = new google.maps.OverlayView();

        TxtOverlay.prototype.onAdd = function() {

          // Note: an overlay's receipt of onAdd() indicates that
          // the map's panes are now available for attaching
          // the overlay to the map via the DOM.

          // Create the DIV and set some basic attributes.
          var div = document.createElement('DIV');
          div.className = this.cls_;

          div.innerHTML = this.txt_;

          // Set the overlay's div_ property to this DIV
          this.div_ = div;
          var overlayProjection = this.getProjection();
          var position = overlayProjection.fromLatLngToDivPixel(this.pos);
          div.style.left = position.x + 'px';
          div.style.top = position.y + 'px';
          // We add an overlay to a map via one of the map's panes.

          var panes = this.getPanes();
          panes.floatPane.appendChild(div);
        }
        TxtOverlay.prototype.draw = function() {


            var overlayProjection = this.getProjection();

            // Retrieve the southwest and northeast coordinates of this overlay
            // in latlngs and convert them to pixels coordinates.
            // We'll use these coordinates to resize the DIV.
            var position = overlayProjection.fromLatLngToDivPixel(this.pos);


            var div = this.div_;
            div.style.left = position.x + 'px';
            div.style.top = position.y + 'px';

        }
          //Optional: helper methods for removing and toggling the text overlay.
        TxtOverlay.prototype.onRemove = function() {
          this.div_.parentNode.removeChild(this.div_);
          this.div_ = null;
        }
        TxtOverlay.prototype.hide = function() {
          if (this.div_) {
            this.div_.style.visibility = "hidden";
          }
        }

        TxtOverlay.prototype.show = function() {
          if (this.div_) {
            this.div_.style.visibility = "visible";
          }
        }

        TxtOverlay.prototype.toggle = function() {
          if (this.div_) {
            if (this.div_.style.visibility == "hidden") {
              this.show();
            } else {
              this.hide();
            }
          }
        }

        TxtOverlay.prototype.toggleDOM = function() {
          if (this.getMap()) {
            this.setMap(null);
          } else {
            this.setMap(this.map_);
          }
        }
    //====================================================

    });
});

Template.mapContent.helpers({
    MapOptions: function() {
        // Make sure the maps API has loaded
        if (GoogleMaps.loaded()) {
            // Map initialization options
            return {
                center: new google.maps.LatLng(34.066109, -106.907439),
                zoom: 18, // 18
                minZoom: 16, // 16
                disableDefaultUI: true,
                fullscreenControl: true,
                styles: [
            {
                featureType: 'poi',
                stylers: [{visibility: 'off'}]
            }
          ]
            };
        }
    }
});
