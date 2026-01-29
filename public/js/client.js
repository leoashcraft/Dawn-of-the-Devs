/**
 * Auto-prepend https:// to URL input fields.
 */
(function () {
  var inputs = document.querySelectorAll('input.url-input');

  inputs.forEach(function (input) {
    function prependScheme() {
      var val = input.value.trim();
      if (val && !/^https?:\/\//i.test(val)) {
        input.value = 'https://' + val;
      }
    }

    input.addEventListener('blur', prependScheme);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        prependScheme();
      }
    });
  });
})();
