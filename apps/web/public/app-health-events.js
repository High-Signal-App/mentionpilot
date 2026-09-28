(function () {
  function track(element) {
    var name = element && element.getAttribute("data-app-health-event");
    if (name && typeof window.appHealth?.track === "function") {
      window.appHealth.track(name);
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    track(target.closest("[data-app-health-event]"));
  });

  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (form instanceof HTMLFormElement) track(form);
    },
    true,
  );
})();
