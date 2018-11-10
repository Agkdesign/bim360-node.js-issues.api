/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

//web services of design automation 

'use strict';   
 
var request = require('request'); 
var fs = require('fs');  
var path = require('path');  

var config = require('../config');  

const _activityIds= {
  v2_dwg_addtext:'XiaodongAddText2DWG',
  v2_dwg_exportpdf:'PlotToPDF',
  v3_revit_upgrater:'revitiosample.FileUpgraderActivity+test'
} 

function createDAWorkItemV2(input){
  return new Promise(function(resolve,reject){ 
    var design_auto_params = {
      Arguments: {
        InputArguments: [
          {
            Name: 'HostDwg',
            Resource: input.sourceItemStg,
            StorageProvider: 'Generic',
            Headers:[
              {
                Name:'Authorization',
                 Value:'Bearer ' + input.credentials.access_token
              }
            ]
          } 
        ],
        OutputArguments: [
          {
             Name: 'Result',
            StorageProvider: 'Generic',
            HttpVerb: 'PUT',
            Resource:input.outputItemStg,
            Headers:[
              {
                Name:'Authorization',
                 Value:'Bearer ' + input.credentials.access_token
              }
            ]
           }
        ]
      },
      Id: '',
      ActivityId: _activityIds[input.actString]
    };   
 
    console.log(JSON.stringify(design_auto_params));
    console.log(input.credentials.access_token);
    var headers = {
      Authorization: 'Bearer ' + input.credentials.access_token,
      'Content-Type': 'application/json' 
    }

    request.post({
      url: config.dav2.createWorkItem(),
      headers: headers,
      body: design_auto_params,
      json: true
    },  function (error, response, body) {

      console.log('createDAWorkItemV2 ' + response.statusCode + error);

      if(error || response.statusCode != 201){
        reject({error:error,reqId:input.reqId});
      }else{ 
        input.workitemId = body.Id; 
        checkWorkItemV2(input,
          function() { 
            console.log('working workitem');

               resolve({status:'done'}); 
          },
          function (workitemId,failure) {
             console.log('One migration failed! ');
             if (failure == 'Reached check limit') {  
              console.log('work item failed ' + input.displayName);
              reject({status:'exception'});
             }
             else
              { 
                console.log('failed workitem');

                var logFileName =  workitemId +'.log'; 

                resolve({status:'failed',
                         logFileName:logFileName,
                         logFileHref:failure,
                         workitemId:workitemId})
               
              }
          }
        );  
      } 
    }); 

  }); 
} 

function checkItemInterval(input,success, failure){ 

  var url = 'https://developer.api.autodesk.com/autocad.io/us-east/v2/WorkItems' + 
  "(Id='" + input.workitemId + "')";
  
  request.get({
    url: url,
    headers: 
      {
         Authorization: 'Bearer ' + input.credentials.access_token,
      }
  },
  function (error, response, body) {
    console.log('checkWorkItemV2 ' + response.statusCode  + ' ' + body );

    if (error) throw error;

    if (response.statusCode == 200) {
      var workItem2 = JSON.parse(body);  

      console.log('   Checked Status: ' + workItem2.Status);

      switch (workItem2.Status) {
        case 'InProgress':
        case 'Pending':
          if (input.checkedTime < 200) {
            input.checkedTime++; 
          } else {
            console.log(' Reached check limit.'); 
            clearInterval(input.checkInterval);
            failure(input.workitemId,'Reached check limit');
          }
          break;
        case 'FailedDownload':
           clearInterval(input.checkInterval); 
          failure(input.workitemId,workItem2.StatusDetails.Report);
        break;
        case 'Succeeded':
          clearInterval(input.checkInterval); 
          success();
          break;
        default:
          clearInterval(input.checkInterval); 
          failure(input.workitemId,workItem2.StatusDetails.Report);
      }
    }
  });
}
function checkWorkItemV2(input, success, failure) {

  console.log(' Checking Work Item Status ' + input.workitemId);

  input.checkedTime = 0; 
  input.checkInterval = setInterval( 
    function() { 
      checkItemInterval(input,success, failure); 
  }, 4000 );


} 

function downloadReport(logFileName,cloudHref) {
  
  return new Promise(function(resolve,reject){  
    console.log(' Downloading and Displaying Report'); 
    var r = request.get(cloudHref).pipe(fs.createWriteStream(__dirname+'/../downloads/'+logFileName));
    r.on('finish',
      function() {
        console.log('   Report File: ' + logFileName);
        resolve({});
      }
    );
  });
} 

module.exports = {
  createDAWorkItemV2:createDAWorkItemV2,
  downloadReport,downloadReport
}; 
