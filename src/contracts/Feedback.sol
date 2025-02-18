// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Feedback {
    struct FeedbackItem {
        address submitter;
        string did;
        string receiverDid;
        string message;
        uint8 rating;
        uint256 timestamp;
    }

    struct Reputation {
        uint256 totalRating;
        uint256 feedbackCount;
        mapping(string => bool) hasRatedDid;
    }

    FeedbackItem[] public feedbacks;
    mapping(string => Reputation) public didReputations;
    mapping(string => bool) public didExists;

    event FeedbackSubmitted(
        address indexed submitter,
        string submitterDid,
        string receiverDid,
        string message,
        uint8 rating,
        uint256 timestamp
    );

    modifier validRating(uint8 _rating) {
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");
        _;
    }

    function submitFeedback(
        string memory _submitterDid,
        string memory _receiverDid,
        string memory _message,
        uint8 _rating
    ) public validRating(_rating) {
        require(bytes(_submitterDid).length > 0, "Submitter DID cannot be empty");
        require(bytes(_receiverDid).length > 0, "Receiver DID cannot be empty");
        require(bytes(_message).length > 0, "Message cannot be empty");

        feedbacks.push(
            FeedbackItem({
                submitter: msg.sender,
                did: _submitterDid,
                receiverDid: _receiverDid,
                message: _message,
                rating: _rating,
                timestamp: block.timestamp
            })
        );

        // Update reputation for receiver
        didReputations[_receiverDid].totalRating += _rating;
        didReputations[_receiverDid].feedbackCount += 1;
        didReputations[_receiverDid].hasRatedDid[_submitterDid] = true;

        didExists[_submitterDid] = true;
        didExists[_receiverDid] = true;

        emit FeedbackSubmitted(
            msg.sender,
            _submitterDid,
            _receiverDid,
            _message,
            _rating,
            block.timestamp
        );
    }

    function getReputation(string memory _did) public view returns (uint256, uint256) {
        Reputation storage rep = didReputations[_did];
        return (rep.totalRating, rep.feedbackCount);
    }

    function getAverageRating(string memory _did) public view returns (uint256) {
        Reputation storage rep = didReputations[_did];
        if (rep.feedbackCount == 0) return 0;
        return (rep.totalRating * 100) / rep.feedbackCount; // Returns rating with 2 decimal places
    }

    function getFeedbackCount() public view returns (uint256) {
        return feedbacks.length;
    }

    function getFeedback(uint256 _index)
        public
        view
        returns (
            address,
            string memory,
            string memory,
            string memory,
            uint8,
            uint256
        )
    {
        require(_index < feedbacks.length, "Index out of bounds");
        FeedbackItem memory item = feedbacks[_index];
        return (
            item.submitter,
            item.did,
            item.receiverDid,
            item.message,
            item.rating,
            item.timestamp
        );
    }
}